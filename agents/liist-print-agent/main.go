package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type config struct {
	supabaseURL string
	anonKey     string
	token       string
	outputDir   string
	printCmd    string
	interval    time.Duration
	agentName   string
}

type claimResponse struct {
	JobID   *string        `json:"job_id"`
	Reason  string         `json:"reason"`
	Payload map[string]any `json:"payload"`
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		exit(err)
	}
	if err := os.MkdirAll(cfg.outputDir, 0o755); err != nil {
		exit(err)
	}

	fmt.Printf("LIIST Print Agent iniciado. Pasta: %s\n", cfg.outputDir)
	for {
		if err := runOnce(cfg); err != nil {
			fmt.Printf("[%s] %v\n", time.Now().Format("15:04:05"), err)
		}
		time.Sleep(cfg.interval)
	}
}

func loadConfig() (config, error) {
	intervalSeconds, _ := strconv.Atoi(firstNonEmpty(os.Getenv("LIIST_PRINT_INTERVAL_SECONDS"), "4"))
	if intervalSeconds < 1 {
		intervalSeconds = 4
	}
	cfg := config{
		supabaseURL: strings.TrimRight(os.Getenv("LIIST_SUPABASE_URL"), "/"),
		anonKey:     os.Getenv("LIIST_SUPABASE_ANON_KEY"),
		token:       os.Getenv("LIIST_PRINT_AGENT_TOKEN"),
		outputDir:   firstNonEmpty(os.Getenv("LIIST_PRINT_OUTPUT_DIR"), "print-outbox"),
		printCmd:    os.Getenv("LIIST_PRINT_COMMAND"),
		interval:    time.Duration(intervalSeconds) * time.Second,
		agentName:   firstNonEmpty(os.Getenv("LIIST_PRINT_AGENT_NAME"), hostname()),
	}
	if cfg.supabaseURL == "" || cfg.anonKey == "" || cfg.token == "" {
		return cfg, errors.New("configure LIIST_SUPABASE_URL, LIIST_SUPABASE_ANON_KEY e LIIST_PRINT_AGENT_TOKEN")
	}
	return cfg, nil
}

func runOnce(cfg config) error {
	var claim claimResponse
	if err := rpc(cfg, "claim_next_print_job", map[string]any{
		"p_token":      cfg.token,
		"p_agent_name": cfg.agentName,
	}, &claim); err != nil {
		return err
	}
	if claim.JobID == nil || *claim.JobID == "" {
		return nil
	}

	filePath := filepath.Join(cfg.outputDir, safeFileName(*claim.JobID)+".txt")
	ticket := formatTicket(claim.Payload)
	if err := os.WriteFile(filePath, []byte(ticket), 0o644); err != nil {
		_ = completeJob(cfg, *claim.JobID, false, err.Error())
		return err
	}

	if cfg.printCmd != "" {
		if err := runPrintCommand(cfg.printCmd, filePath); err != nil {
			_ = completeJob(cfg, *claim.JobID, false, err.Error())
			return err
		}
	}

	if err := completeJob(cfg, *claim.JobID, true, ""); err != nil {
		return err
	}
	fmt.Printf("[%s] Comanda %s processada em %s\n", time.Now().Format("15:04:05"), text(claim.Payload["order_code"]), filePath)
	return nil
}

func completeJob(cfg config, jobID string, success bool, message string) error {
	var response map[string]any
	return rpc(cfg, "complete_print_job", map[string]any{
		"p_token":   cfg.token,
		"p_job_id":  jobID,
		"p_success": success,
		"p_error":   nullable(message),
	}, &response)
}

func rpc(cfg config, functionName string, body map[string]any, out any) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	request, err := http.NewRequest(http.MethodPost, cfg.supabaseURL+"/rest/v1/rpc/"+functionName, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("apikey", cfg.anonKey)
	request.Header.Set("Authorization", "Bearer "+cfg.anonKey)

	client := &http.Client{Timeout: 20 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	content, _ := io.ReadAll(response.Body)
	if response.StatusCode < 200 || response.StatusCode > 299 {
		return fmt.Errorf("%s: %s", response.Status, strings.TrimSpace(string(content)))
	}
	if len(content) == 0 || out == nil {
		return nil
	}
	return json.Unmarshal(content, out)
}

func formatTicket(payload map[string]any) string {
	var b strings.Builder
	company := object(payload["company"])
	store := object(payload["store"])
	table := object(payload["table"])

	line(&b, strings.ToUpper(firstNonEmpty(text(company["name"]), "LIIST")))
	line(&b, firstNonEmpty(text(store["name"]), "Comanda interna"))
	line(&b, strings.Repeat("-", 32))
	line(&b, "Comanda: "+text(payload["order_code"]))
	if table != nil {
		line(&b, "Mesa: "+firstNonEmpty(text(table["name"]), text(table["code"])))
	}
	line(&b, "Origem: "+sourceLabel(text(payload["source"])))
	if text(payload["customer_name"]) != "" {
		line(&b, "Cliente: "+text(payload["customer_name"]))
	}
	if text(payload["created_by_name"]) != "" {
		line(&b, "Lancado por: "+text(payload["created_by_name"]))
	}
	line(&b, "Horario: "+timeLabel(text(payload["created_at"])))
	line(&b, strings.Repeat("-", 32))

	totalAdditions := 0.0
	for _, rawItem := range list(payload["items"]) {
		item := object(rawItem)
		quantity := number(item["quantity"])
		unitPrice := number(item["unit_price"])
		itemTotal := number(item["total"])
		line(&b, fmt.Sprintf("%sx %s", quantityLabel(quantity), text(item["product_name"])))
		line(&b, fmt.Sprintf("  %s  Total %s", money(unitPrice), money(itemTotal)))
		for _, rawOption := range list(item["selected_options"]) {
			option := object(rawOption)
			price := number(option["price_delta"])
			totalAdditions += price * quantity
			prefix := "  + "
			if text(option["group_name"]) != "" {
				prefix += text(option["group_name"]) + ": "
			}
			line(&b, prefix+text(option["item_name"])+" "+money(price))
		}
	}

	line(&b, strings.Repeat("-", 32))
	if totalAdditions > 0 {
		line(&b, "Adicionais: "+money(totalAdditions))
	}
	line(&b, "TOTAL: "+money(number(payload["total"])))
	if text(payload["notes"]) != "" {
		line(&b, strings.Repeat("-", 32))
		line(&b, "Observacao:")
		line(&b, text(payload["notes"]))
	}
	line(&b, strings.Repeat("-", 32))
	line(&b, "LIIST")
	return b.String()
}

func runPrintCommand(template string, filePath string) error {
	command := strings.ReplaceAll(template, "{file}", filePath)
	if runtime.GOOS == "windows" {
		return exec.Command("cmd", "/C", command).Run()
	}
	return exec.Command("sh", "-c", command).Run()
}

func line(b *strings.Builder, value string) {
	b.WriteString(value)
	b.WriteByte('\n')
}

func object(value any) map[string]any {
	result, _ := value.(map[string]any)
	return result
}

func list(value any) []any {
	result, _ := value.([]any)
	return result
}

func text(value any) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

func number(value any) float64 {
	switch current := value.(type) {
	case float64:
		return current
	case float32:
		return float64(current)
	case int:
		return float64(current)
	case int64:
		return float64(current)
	case json.Number:
		parsed, _ := current.Float64()
		return parsed
	case string:
		parsed, _ := strconv.ParseFloat(strings.ReplaceAll(current, ",", "."), 64)
		return parsed
	default:
		return 0
	}
}

func quantityLabel(value float64) string {
	if value == float64(int64(value)) {
		return fmt.Sprintf("%.0f", value)
	}
	return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.3f", value), "0"), ".")
}

func money(value float64) string {
	return "R$ " + strings.ReplaceAll(fmt.Sprintf("%.2f", value), ".", ",")
}

func timeLabel(value string) string {
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return value
	}
	return parsed.Local().Format("02/01/2006 15:04")
}

func sourceLabel(value string) string {
	switch value {
	case "table_device":
		return "Mesa"
	case "staff":
		return "Equipe"
	case "customer":
		return "Cliente"
	default:
		return firstNonEmpty(value, "Interna")
	}
}

func nullable(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func hostname() string {
	name, err := os.Hostname()
	if err != nil || strings.TrimSpace(name) == "" {
		return "LIIST Print Agent"
	}
	return name
}

func safeFileName(value string) string {
	replacer := strings.NewReplacer("\\", "-", "/", "-", ":", "-", "*", "-", "?", "-", "\"", "-", "<", "-", ">", "-", "|", "-")
	return replacer.Replace(value)
}

func exit(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
