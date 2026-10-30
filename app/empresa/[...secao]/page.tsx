"use client";

import AdminPage from "../../admin/page";

// Subseções do painel da empresa (/empresa/cardapio, /empresa/ajustes/marca...).
export default function CompanyPortalSectionPage() {
  return <AdminPage portalMode="company" />;
}
