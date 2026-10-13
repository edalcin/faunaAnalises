// Tema claro/escuro e rodapé comum a todas as páginas do FaunaBR.
const raiz = document.documentElement;
const salvo = localStorage.getItem("tema");
raiz.dataset.theme = salvo ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

export function iniciar({ referencia } = {}) {
  const botao = document.querySelector(".tema");
  const rotular = () => (botao.textContent = raiz.dataset.theme === "dark" ? "Tema claro" : "Tema escuro");
  botao?.addEventListener("click", () => {
    raiz.dataset.theme = raiz.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("tema", raiz.dataset.theme);
    rotular();
    dispatchEvent(new Event("tema"));
  });
  if (botao) rotular();
  const data = referencia ? referencia.split("-").reverse().join("/") : "";
  document.querySelector(".rodape").innerHTML = `
    <p>Fonte: <a href="https://fauna.jbrj.gov.br/fauna/listaBrasil/PrincipalUC/PrincipalUC.do?lingua=pt">Catálogo Taxonômico da Fauna do Brasil</a>,
    Instituto de Pesquisas Jardim Botânico do Rio de Janeiro (JBRJ)${data ? `, dados de ${data}` : ""}.</p>
    <p>Análise do projeto FaunaBR, por Eduardo Dalcin. Dados e textos derivados sob
    <a href="https://creativecommons.org/licenses/by/4.0/deed.pt-br">CC BY 4.0</a>.</p>`;
}
