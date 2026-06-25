import * as XLSX from "xlsx";

export function fmtMoeda(v) {
  if (v == null || v === "") return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

export function fmtNumero(v) {
  if (v == null || v === "") return "—";
  return new Intl.NumberFormat("pt-BR").format(v);
}

export function fmtValor(tipoMeta, v) {
  if (v == null || v === "") return "—";
  return tipoMeta === "Faturamento" ? fmtMoeda(v) : `${fmtNumero(v)} leads`;
}

export function fmtData(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// percentual de aderência calculado
export function pctAderencia(meta, realizado) {
  if (!meta || realizado == null) return null;
  return Math.round((realizado / meta) * 100);
}

export function exportarXLSX(registros, clientes, gestores) {
  const cliNome = (id) => clientes.find((c) => c.id === id)?.nome || "—";
  const gestNome = (id) => {
    const cl = clientes.find((c) => c.id === id);
    return gestores.find((g) => g.id === cl?.responsavelId)?.nome || "—";
  };

  const linhas = registros
    .slice()
    .sort((a, b) => (a.data < b.data ? 1 : -1))
    .map((r) => ({
      Data: fmtData(r.data),
      Cliente: cliNome(r.clienteId),
      Responsável: gestNome(r.clienteId),
      Criticidade: r.criticidade,
      "Tipo de Meta": r.tipoMeta,
      Meta: r.meta ?? "",
      Realizado: r.realizado ?? "",
      "Aderência (%)": pctAderencia(r.meta, r.realizado) ?? "",
      "Aderência a Meta": r.aderencia,
      Acompanhamento: r.acompanhamento,
    }));

  const ws = XLSX.utils.json_to_sheet(linhas);
  ws["!cols"] = [
    { wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 70 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Histórico");
  const nome = `OffChurn_Historico_${hoje()}.xlsx`;
  XLSX.writeFile(wb, nome);
}
