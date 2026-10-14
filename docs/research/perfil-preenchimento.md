# Perfil de preenchimento dos atributos de espécie

Resposta ao ticket [#2](https://github.com/edalcin/faunaAnalises/issues/2) (mapa [#1](https://github.com/edalcin/faunaAnalises/issues/1)). Só fatos medidos em `dados/fauna.sqlite` (snapshot de 2026-10-13, convertido do dump `backup_fauna_2026_09_09.dump`); as definições de métrica ficam para outro ticket. Modelo e dicionário: `dados/modeloERctf.md`.

## Universo e definições

Universo: `taxon_base` com `taxon_name_base.rank IN ('ESPECIE','SUB_ESPECIE')`. Hub: `dados_lista_brasil` via `taxon_base.dados_lista_brasil_fk` (existe para todos, exceto 2 SUB_ESPECIE aceitas).

| Grupo | `is_synonym` | ESPECIE | SUB_ESPECIE | Total |
|---|---|---|---|---|
| Aceitos | 0 | 131.118 | 6.748 | 137.866 |
| Sinônimos | 1 | 20.781 | 953 | 21.734 |
| Sem status | NULL | 468 | 31 | 499 |

Percentuais usam o total do grupo como denominador. Três níveis de "preenchido":

- **não nulo**: `IS NOT NULL`.
- **não vazio**: não nulo e `trim(x)` (espaço, `\t`, `\r`, `\n`) diferente de `''`. É o critério das tabelas abaixo, salvo nota em contrário.
- **útil** (só campos HTML: `bibliografia_referencia`, `observacoes_internas`, `voucher_fauna`): o texto vem escapado (`&lt;p&gt;&amp;nbsp;&lt;/p&gt;`); "útil" = sobra algum caractere depois de remover tags e entidades. Função `util()` na seção de consultas.

Tabelas ligadas (1:1, 1:N, N:N): conta-se a espécie quando existe ao menos uma linha com conteúdo, não o número de linhas.

Pontos gerais:

- `dados_lista_brasil` tem 241.310 linhas; 37.268 não são apontadas por nenhum `taxon_base`.
- O banco tem muitas tabelas do modelo **vazias** (0 linhas): `referencia_lista`, `voucher_lista`, `duplicata_lista`, `herbario`, `coletor`, `figura`, `figura_lista`, `imagem_lista`, `est`, `municipio`. Ver seção [Campos sempre vazios](#campos-sempre-vazios).
- Sinônimos têm hub e distribuição para 100% e linha de hospedeiro para 99,9%, mas o conteúdo dessas linhas é raro (ver tabelas).

## 1. Núcleo taxonômico

| Atributo | Onde mora | Aceitos n (%) | Sinônimos n (%) | Sem status % | Observação |
|---|---|---|---|---|---|
| Registro editorial (`dados_lista_brasil`) | hub, via `taxon_base.dados_lista_brasil_fk` | 137.864 (100,0%) | 21.734 (100,0%) | 100,0% | 2 SUB_ESPECIE aceitas sem hub (`dados_lista_brasil_fk` nulo) |
| `registro` = CHECADO | `dados_lista_brasil.registro` | 137.576 (99,8%) | 21.633 (99,5%) | 94,6% | NOT NULL; resto é `NAO_CHECADO` |
| Autor do nome | `taxon_name_base.autor` | 137.740 (99,9%) | 21.734 (100,0%) | 100,0% | Sem strings vazias (não nulo = não vazio) |
| Ano do nome | `taxon_name_base.ano` | 137.741 (99,9%) | 21.734 (100,0%) | 100,0% | 1.017 valores do universo não têm 4 dígitos |
| Gênero | `taxon_name_base.genus_or_uninomial` | 137.866 (100,0%) | 21.734 (100,0%) | 100,0% | Obrigatório na prática |
| Epíteto específico | `taxon_name_base.specific_epithet` | 137.866 (100,0%) | 21.734 (100,0%) | 100,0% |  |
| Epíteto subespecífico | `taxon_name_base.subsp_specific_epithet` | 6.750 (4,9%) | 953 (4,4%) | 6,2% | ≈ nº de SUB_ESPECIE aceitas (6.748) |
| Subgênero | `taxon_name_base.infra_generic_epithet` | 13.526 (9,8%) | 1.414 (6,5%) | 2,4% | Opcional por natureza |
| Nome com cache (`name_cache`, `name_autor_cache`) | `taxon_name_base` | 137.866 (100,0%) | 21.734 (100,0%) | 100,0% | Derivados |
| Táxon-pai | `taxon_base.parent_fk` | 137.865 (100,0%) | 21.734 (100,0%) | 100,0% | 1 aceito sem pai |
| Disponibilidade | `taxon_base.disponibilidade` | 137.817 (100,0%) | 21.714 (99,9%) | 99,6% | 49 aceitos e 20 sinônimos nulos; INDISPONIVEL só aparece em sem-status (346 de 499) |
| Combinação (corrente / não corrente) | `taxon_base.combinacao` | 17.638 (12,8%) | 1.283 (5,9%) | 0,2% | Valores `corrente`/`nao_corrente`; nulo no restante |
| `non` (homônimo posterior) | `taxon_name_base.non` | 1 (<0,1%) | 174 (0,8%) | 0,2% | Coluna é quase só string vazia: não nulo = 96.450 aceitos, mas não vazio = 1 |
| Nova combinação = verdadeiro | `taxon_name_base.nova_combinacao` | 51.785 (37,6%) | 4.833 (22,2%) | 20,4% | Booleano; 99,9% preenchido (não nulo), % acima = TRUE |
| Autor padronizado = verdadeiro | `taxon_name_base.autor_padronizado` | 28.590 (20,7%) | 999 (4,6%) | 7,0% | Booleano; % acima = TRUE (95,8% dos aceitos têm o valor não nulo) |
| Epíteto infraespecífico típico = verdadeiro | `taxon_name_base.infra_specific_typical` | 2.192 (1,6%) | 136 (0,6%) | 2,4% | Só para SUB_ESPECIE na prática |
| É sinônimo de (relação existe) | `synonym_relationship.synonym_fk` | 2 (<0,1%) | 21.530 (99,1%) | 8,8% | 2 aceitos e 44 sem-status aparecem como sinônimos; 204 sinônimos sem nome aceito |
| Tem sinônimos (como nome aceito) | `synonym_relationship.accept_name_fk` | 11.483 (8,3%) | 228 (1,0%) | 2,4% | 228 sinônimos também figuram como nome aceito de outro |
| Qualificador (coluna) | `dados_lista_brasil.qualificador` | 2.482 (1,8%) | 345 (1,6%) | 0,4% | ORIGINAL_COMBINATION / CHANGED_COMBINATION quase todos |
| Qualificadores (N:N) | `dados_lista_brasil_qualif` → `qualificador` | 42.754 (31,0%) | 13.605 (62,6%) | 59,9% | Fonte principal do qualificador; ORIGINAL/CHANGED/COMBINATION nos aceitos, JUNIOR_SYNONYM_* nos sinônimos |
| Código ITIS | `dados_lista_brasil.itis` | 2 (<0,1%) | 0 (0,0%) | 0,0% | Coluna não nula em 5,1% dos aceitos / 58,0% dos sinônimos, mas **só strings vazias** |
| ZooBank LSID | `dados_lista_brasil.zoo_bank` | 2.992 (2,2%) | 254 (1,2%) | 1,4% | Não nulo = 69,9% aceitos, mas quase tudo `''`; 28 valores `none` |
| species_id (URL/LSID externo) | `dados_lista_brasil.species_id` | 1.237 (0,9%) | 18 (<0,1%) | 1,6% | Idem: não nulo = 60,7% aceitos, não vazio = 0,9% |
| `id_lista_brasil` | `dados_lista_brasil.id_lista_brasil` | 0 (0,0%) | 0 (0,0%) | 0,0% | Sempre nulo |

## 2. Distribuição geográfica e ecológica

| Atributo | Onde mora | Aceitos n (%) | Sinônimos n (%) | Sem status % | Observação |
|---|---|---|---|---|---|
| Linha de distribuição | `distribuicao` (1:1 com hub) | 137.864 (100,0%) | 21.734 (100,0%) | 100,0% | Existe para 100%; é um 'invólucro' |
| Origem | `distribuicao.origem` | 104.422 (75,7%) | 2.283 (10,5%) | 21,0% | NATIVA em 97.705 dos 104.422 aceitos com valor; default de coluna é NATIVA mas 24,3% dos aceitos têm nulo |
| Endêmica do Brasil (não nulo) | `distribuicao.endemica_brasil` | 64.872 (47,1%) | 923 (4,2%) | 8,4% | Valor TRUE em 23,0% dos aceitos |
| UF de ocorrência | `distribuicao_abrangencia` → `abrangencia_geografica` | 89.633 (65,0%) | 942 (4,3%) | 8,8% | Média ≈3 UF por espécie com dado; `certeza_ocorre`=1 em 84,2% das 287.277 linhas (45.447 com 0) |
| Países | `distribuicao_paises` → `pais` | 33.662 (24,4%) | 382 (1,8%) | 3,8% | Inclui BRAZIL (9.180 linhas no banco) |
| Países ≠ Brasil | idem | 29.637 (21,5%) | 299 (1,4%) | 3,4% | Ao menos um país diferente de BRAZIL |
| Domínio biogeográfico marinho | `distribuicao_dom_bio_marinho` | 8.209 (6,0%) | 62 (0,3%) | 2,2% | Ver condicionais (MARINHO) |
| Domínio epicontinental (biomas + bacias) | `distribuicao_dom_bio_epicontin` | 40.783 (29,6%) | 377 (1,7%) | 3,4% | Mistura biomas (AMAZONIA, CERRADO…) e BACIA_*; ver condicionais |
| Bacias hidrográficas | `distribuicao_hidrografica` → `abrangencia_hidrografica` | 17 (<0,1%) | 0 (0,0%) | 0,0% | Praticamente sem uso (17 aceitos); valores BACIA_* aparecem em `dom_bio_epicontinental` |
| Regiões marinhas | `distribuicao_marinha` → `abrangencia_marinha` | 2 (<0,1%) | 0 (0,0%) | 0,0% | Praticamente sem uso (2 aceitos); região marinha aparece em `dom_bio_marinho` |
| Domínio biogeográfico | `distribuicao_dom_biogeografico` | 0 (0,0%) | 0 (0,0%) | 0,0% | 1 linha no banco, nenhuma no universo |
| Macro-habitat | `distribuicao_macrohabitat` | 3 (<0,1%) | 0 (0,0%) | 0,0% | 3 aceitos no total |
| Ambiente MARINHO | `ambiente_distribuicao` → `ambiente.tipo` | 18.956 (13,7%) | 10.079 (46,4%) | 44,5% | Um único tipo por distribuição (nenhuma tem MARINHO e EPICONTINENTAL) |
| Ambiente EPICONTINENTAL | idem | 83.132 (60,3%) | 2.416 (11,1%) | 15,0% |  |
| Ambiente VAZIO (valor explícito) | idem (`tipo='VAZIO'`) | 10.287 (7,5%) | 9.128 (42,0%) | 36,3% | `VAZIO` é um valor do domínio CHECK: significa 'não informado', não é ausência de linha |
| Com ao menos uma linha de ambiente (qualquer tipo) | idem | 112.375 (81,5%) | 21.623 (99,5%) | 95,8% | O complemento (18,5% dos aceitos) não tem nenhuma linha de ambiente |
| Distribuição sem nenhuma abrangência | `distribuicao` sem UF/bacia/mar/país | 45.518 (33,0%) | 20.656 (95,0%) | 90,2% | Linha existe mas vazia quanto a abrangência |
| Distribuição sem abrangência nem domínio/macro | idem + dom_*/macrohabitat | 45.168 (32,8%) | 20.640 (95,0%) | 90,2% |  |
| Distribuição totalmente vazia | sem origem, endemismo, abrangência, domínio, macro nem ambiente MARINHO/EPICONTINENTAL | 20.899 (15,2%) | 8.907 (41,0%) | 37,9% | `VAZIO` conta como vazio |
| Distribuição com algum dado | complemento do anterior | 116.965 (84,8%) | 12.827 (59,0%) | 62,1% |  |

`distribuicao_abrangencia` tem 287.277 linhas no banco; a média de UF por espécie com dado é 3,1 (aceitos) e 2,9 (sinônimos).

## 3. Atributos biológicos e hospedeiros

| Atributo | Onde mora | Aceitos n (%) | Sinônimos n (%) | Sem status % | Observação |
|---|---|---|---|---|---|
| Forma de vida | `dados_lista_brasil_forma_vida` → `forma_vida` | 79.917 (58,0%) | 1.154 (5,3%) | 9,0% | Multivalorado; 16 tipos |
| Substrato | `dados_lista_brasil_substrato` → `substrato` | 84.874 (61,6%) | 1.221 (5,6%) | 9,8% | Multivalorado; 9 tipos (TERRESTRE e AGUA_DOCE/MARINHO dominam) |
| `hospedeiro_fk` apontando para linha | `dados_lista_brasil.hospedeiro_fk` → `hospedeiro` | 115.439 (83,7%) | 21.714 (99,9%) | 99,6% | Quase sempre uma linha criada automaticamente |
| Hospedeiro vegetal | `hospedeiro_vegetal.hospedeiro_fk` | 2.399 (1,7%) | 78 (0,4%) | 0,0% |  |
| Hospedeiro animal externo | `animal_host_name_hospedeiro` → `animal_host_name` | 927 (0,7%) | 19 (<0,1%) | 0,6% |  |
| Hospedeiro animal da fauna (catálogo) | `hospedeiro_hospedeiros_animais` → `taxon_name_base` | 5.000 (3,6%) | 115 (0,5%) | 2,4% | Fonte mais comum de hospedeiro |
| **Hospedeiro com conteúdo** (vegetal ∨ animal ∨ fauna) | união das três | 7.800 (5,7%) | 205 (0,9%) | 3,0% |  |
| Hospedeiro linha vazia | `hospedeiro` sem vegetal/animal/fauna | 107.639 (78,1%) | 21.509 (99,0%) | 96,6% | Linha existe mas sem hospedeiro |
| … marcado `indeterminado`=TRUE | `hospedeiro.indeterminado` | 5.152 (3,7%) | 214 (1,0%) | 1,6% | Todas as linhas `indeterminado`=1 estão sem hospedeiro (declaração explícita de desconhecido) |
| … vazia e não `indeterminado` | idem | 102.487 (74,3%) | 21.295 (98,0%) | 95,0% | Linha vazia pura |
| Nome vernáculo (qualquer língua) | `nm_vernaculo` | 26.993 (19,6%) | 737 (3,4%) | 3,8% | Sem nomes vazios; média ≈1,5 nome por espécie com dado |
| … em português | `nm_vernaculo.lingua`='PORTUGUES' | 26.711 (19,4%) | 731 (3,4%) | 3,6% |  |
| … em inglês | idem | 2.902 (2,1%) | 36 (0,2%) | 0,8% |  |
| … em espanhol | idem | 252 (0,2%) | 6 (<0,1%) | 0,0% |  |

## 4. Referências, vouchers e mídia (onde mora cada informação)

| Atributo | Onde mora | Aceitos n (%) | Sinônimos n (%) | Sem status % | Observação |
|---|---|---|---|---|---|
| Publicação original — FK | `dados_lista_brasil.publicacao_original_fk` | 0 (0,0%) | 0 (0,0%) | 0,0% | Sempre nulo |
| Publicação original — tabela `referencia_lista` | `referencia_lista` | 0 (0,0%) | 0 (0,0%) | 0,0% | Tabela tem 0 linhas |
| Publicação original — texto livre | `dados_lista_brasil.bibliografia_referencia` (HTML) | 68.682 (49,8%) | 5.340 (24,6%) | 24,0% | Onde a maioria mora. Não nulo = 83,7% aceitos; não vazio (trim) = 60,3%; útil = após remover HTML/`&nbsp;` |
| Publicação original — objeto CSL | `campos_json.bibliografia.main` | 10.640 (7,7%) | 929 (4,3%) | 5,2% | JSON em CSL (título, autores, periódico, DOI, URL) |
| … principal com DOI | `campos_json.bibliografia.main.DOI` | 4.438 (3,2%) | 232 (1,1%) | 1,4% |  |
| … principal com URL | `campos_json.bibliografia.main.URL` | 5.378 (3,9%) | 456 (2,1%) | 2,6% |  |
| Bibliografia adicional | `campos_json.bibliografia.additional[]` | 5.287 (3,8%) | 578 (2,7%) | 2,4% |  |
| Publicação (texto ∨ CSL) | união de `bibliografia_referencia` útil e `bibliografia.main` | 74.566 (54,1%) | 6.149 (28,3%) | 26,5% |  |
| Publicação (texto ∧ CSL) | interseção | 4.756 (3,4%) | 120 (0,6%) | 2,8% | Duas fontes raramente coexistem |
| Sem nenhuma publicação (texto nem CSL) | complemento | 63.300 (45,9%) | 15.585 (71,7%) | 73,5% | Autor/ano (`taxon_name_base`) são quase 100% mas não substituem a citação |
| Material-tipo: primário (linha) | `primario` (1:1) | 83.544 (60,6%) | 6.556 (30,2%) | 45,3% | Linha existe em 60,6% dos aceitos |
| … com algum campo preenchido | `primario` | 13.344 (9,7%) | 511 (2,4%) | 1,8% | `tipo_primario` é o campo-guia (preenchido ⇔ algum campo) |
| … linha toda vazia | `primario` | 70.200 (50,9%) | 6.045 (27,8%) | 43,5% | Linha criada na inclusão da espécie, sem dados |
| Material-tipo: secundário | `secundario` (1:N, 9.721 linhas) | 3.903 (2,8%) | 171 (0,8%) | 0,0% | Linhas existentes sempre têm tipo |
| Material-tipo: coletivo (linha) | `coletivo` (1:1) | 83.544 (60,6%) | 6.556 (30,2%) | 45,3% | Mesmo padrão do primário |
| … com algum campo preenchido | `coletivo` | 1.326 (1,0%) | 119 (0,5%) | 1,2% |  |
| **Material-tipo (qualquer, com tipo preenchido)** | primário ∨ secundário ∨ coletivo | 14.758 (10,7%) | 626 (2,9%) | 2,8% | `dados_lista_brasil.tipo_primario` é sempre nulo |
| Voucher / observação sobre testemunhos (texto) | `dados_lista_brasil.voucher_fauna` (HTML) | 6.756 (4,9%) | 276 (1,3%) | 1,6% | Não nulo = 80,5%; não vazio = 30,5%; útil = 4,9% |
| Voucher estruturado | `voucher_lista`, `duplicata_lista`, `herbario`, `coletor` | 0 (0,0%) | 0 (0,0%) | 0,0% | Tabelas com 0 linhas |
| Imagens | `figura`, `figura_lista`, `imagem_lista` | 0 (0,0%) | 0 (0,0%) | 0,0% | Tabelas com 0 linhas |
| Observações internas (texto) | `dados_lista_brasil.observacoes_internas` (HTML) | 8.902 (6,5%) | 428 (2,0%) | 8,4% | Não nulo = 83,7%, não vazio = 31,5%, útil = 6,5% |

Resumo de "onde mora de fato":

| Informação sugerida pelo modelo | Onde está de fato | Observação |
|---|---|---|
| Publicação original (`publicacao_original_fk` → `referencia_lista`) | Texto HTML em `bibliografia_referencia` (aceitos: 68.682 (49,8%)) e objeto CSL em `campos_json.bibliografia.main` (aceitos: 10.640 (7,7%)) | FK e `referencia_lista` vazias; autor/ano de `taxon_name_base` cobrem ~100% mas só identificam o nome. Dos 68.682 textos úteis em aceitos, 38.714 são distintos (há texto repetido entre espécies). |
| Material-tipo | `primario` / `secundario` / `coletivo` | `dados_lista_brasil.tipo_primario` sempre nulo; `primario`/`coletivo` têm linha para ~60% dos aceitos, a maioria vazia. |
| Vouchers | só o texto HTML `voucher_fauna` | `voucher_lista`/`duplicata_lista`/`herbario` com 0 linhas. 6.489 textos distintos em 6.756 úteis (aceitos). |
| Imagens | em lugar nenhum | `figura`, `figura_lista`, `imagem_lista` com 0 linhas. |
| IDs externos | `zoo_bank`, `species_id`, `itis` no hub | `itis` sem nenhum valor útil; `zoo_bank`/`species_id` são strings vazias em quase tudo. |
| Nomes vernáculos | `nm_vernaculo` (1:N) | 52.521 linhas; ver seção 3. |

## Atributos condicionais

### Hospedeiro × forma de vida parasita

Parasita = forma de vida em ECTOPARASITO, ENDOPARASITO, ECTOPARASITOIDE, ENDOPARASITOIDE ou HIPERPARASITOIDE. Hospedeiro com conteúdo = vegetal ∨ animal externo ∨ animal da fauna.

| Subconjunto | Aceitos n (%) | Sinônimos n (%) | Sem status % |
|---|---|---|---|
| Forma de vida parasita (ECTO/ENDOPARASITO, ECTO/ENDO/HIPERPARASITOIDE) | 7.707 (5,6%) | 148 (0,7%) | 2,2% |
| … com hospedeiro (vegetal ∨ animal ∨ fauna) | 5.041 (3,7%) | 98 (0,5%) | 2,0% |
| … com hospedeiro ∨ `indeterminado` | 5.440 (3,9%) | 99 (0,5%) | 2,2% |
| … sem hospedeiro (linha vazia ou inexistente) | 2.267 (1,6%) | 49 (0,2%) | 0,0% |
| Com forma de vida, não parasita | 72.210 (52,4%) | 1.006 (4,6%) | 6,8% |
| … mas com hospedeiro | 2.244 (1,6%) | 13 (<0,1%) | 0,0% |
| Sem forma de vida | 57.947 (42,0%) | 20.580 (94,7%) | 91,0% |
| … mas com hospedeiro | 515 (0,4%) | 94 (0,4%) | 1,0% |
| Hospedeiro com conteúdo (total) | 7.800 (5,7%) | 205 (0,9%) | 3,0% |
| ECTOPARASITO | 2.834 (2,1%) | 28 (0,1%) | 0,0% |
| ENDOPARASITO | 3.585 (2,6%) | 97 (0,4%) | 2,2% |
| ECTOPARASITOIDE | 940 (0,7%) | 9 (<0,1%) | 0,0% |
| ENDOPARASITOIDE | 413 (0,3%) | 14 (<0,1%) | 0,0% |
| HIPERPARASITOIDE | 8 (<0,1%) | 0 (0,0%) | 0,0% |
| ECTOPARASITO ∧ hospedeiro | 1.995 (1,4%) | 20 (<0,1%) | 0,0% |
| ENDOPARASITO ∧ hospedeiro | 2.888 (2,1%) | 74 (0,3%) | 2,0% |
| ECTOPARASITOIDE ∧ hospedeiro | 14 (<0,1%) | 0 (0,0%) | 0,0% |
| ENDOPARASITOIDE ∧ hospedeiro | 147 (0,1%) | 4 (<0,1%) | 0,0% |
| HIPERPARASITOIDE ∧ hospedeiro | 1 (<0,1%) | 0 (0,0%) | 0,0% |

Proporção de parasitas aceitos com hospedeiro: 5.041 / 7.707 (65,4%); de aceitos com hospedeiro que são parasitas: 5.041 / 7.800 (64,6%). Para sinônimos: 98 / 148 (66,2%) e 98 / 205 (47,8%).

### Distribuição marinha e epicontinental × ambiente

`dom_bio_epicontinental` mistura biomas (AMAZONIA, CERRADO, MATA_ATLANTICA, CAATINGA, PAMPA, PANTANAL) e bacias (BACIA_*). `distribuicao_hidrografica` ("bacias") e `distribuicao_marinha` são praticamente vazias; o conteúdo equivalente está em `dom_bio_epicontinental` e `dom_bio_marinho`.

| Subconjunto | Aceitos n (%) | Sinônimos n (%) | Sem status % |
|---|---|---|---|
| Ambiente MARINHO | 18.956 (13,7%) | 10.079 (46,4%) | 44,5% |
| … com `dom_bio_marinho` | 7.875 (5,7%) | 50 (0,2%) | 2,2% |
| … com `distribuicao_marinha` | 2 (<0,1%) | 0 (0,0%) | 0,0% |
| … com algum dos dois | 7.877 (5,7%) | 50 (0,2%) | 2,2% |
| … com UF | 13.010 (9,4%) | 88 (0,4%) | 3,4% |
| … sem UF, sem dom_bio_marinho e sem marinha | 5.848 (4,2%) | 9.985 (45,9%) | 41,1% |
| Não MARINHO com `dom_bio_marinho` | 334 (0,2%) | 12 (<0,1%) | 0,0% |
| Não MARINHO com `distribuicao_marinha` | 0 (0,0%) | 0 (0,0%) | 0,0% |
| `dom_bio_marinho` (total) | 8.209 (6,0%) | 62 (0,3%) | 2,2% |
| Ambiente EPICONTINENTAL | 83.132 (60,3%) | 2.416 (11,1%) | 15,0% |
| … com `dom_bio_epicontinental` | 39.019 (28,3%) | 341 (1,6%) | 3,2% |
| … … só valores BACIA_* | 7.635 (5,5%) | 109 (0,5%) | 1,2% |
| … … só biomas (AMAZONIA, CERRADO, …) | 33.412 (24,2%) | 249 (1,1%) | 2,2% |
| … com `distribuicao_hidrografica` (bacias) | 17 (<0,1%) | 0 (0,0%) | 0,0% |
| … com UF | 68.885 (50,0%) | 737 (3,4%) | 5,0% |
| … sem UF, sem dom_epi e sem bacias | 13.723 (10,0%) | 1.667 (7,7%) | 9,8% |
| Não EPICONTINENTAL com `dom_bio_epicontinental` | 1.764 (1,3%) | 36 (0,2%) | 0,2% |
| `dom_bio_epicontinental` com algum BACIA_* (total) | 7.931 (5,8%) | 120 (0,6%) | 1,2% |
| Ambiente VAZIO (nem MARINHO nem EPICONTINENTAL) | 10.287 (7,5%) | 9.128 (42,0%) | 36,3% |
| Sem ambiente M ou E mas com UF | 7.738 (5,6%) | 117 (0,5%) | 0,4% |
| Sem nenhuma linha de ambiente | 25.491 (18,5%) | 111 (0,5%) | 4,2% |

Fatos adicionais: nenhum aceito tem ambiente MARINHO e EPICONTINENTAL ao mesmo tempo. Entre aceitos MARINHO, 7.875 / 18.956 (41,5%) têm `dom_bio_marinho`; entre sinônimos, 50 / 10.079 (0,5%). Entre aceitos EPICONTINENTAL, 39.019 / 83.132 (46,9%) têm `dom_bio_epicontinental`.

## ESPECIE × SUB_ESPECIE

| | Aceitos | Sinônimos | Sem status |
|---|---|---|---|
| ESPECIE | 131.118 | 20.781 | 468 |
| SUB_ESPECIE | 6.748 (6.746 com hub) | 953 | 31 |
| SUB_ESPECIE / total | 4.9% | 4.4% | 6.2% |

Quando há pai, `parent_fk` de SUB_ESPECIE aponta sempre para uma ESPECIE e o de ESPECIE para GENERO ou SUB_GENERO. Preenchimento por rank (% do grupo×rank; SUB_ESPECIE aceita usa 6.748 como denominador):

| Atributo | Aceitos ESPECIE | Aceitos SUB_ESPECIE | Sinônimos ESPECIE | Sinônimos SUB_ESPECIE |
|---|---|---|---|---|
| Texto da publicação (útil) | 49,3% | 59,6% | 25,0% | 16,2% |
| CSL `bibliografia.main` | 8,0% | 2,4% | 4,3% | 3,1% |
| Alguma UF | 65,0% | 66,0% | 4,4% | 2,7% |
| `origem` | 76,0% | 69,8% | 10,6% | 8,0% |
| `endemica_brasil` não nulo | 46,7% | 53,7% | 4,3% | 3,7% |
| Ambiente MARINHO ou EPICONTINENTAL | 74,1% | 72,9% | 57,1% | 67,1% |
| Forma de vida | 57,5% | 67,5% | 5,4% | 4,0% |
| Substrato | 61,2% | 68,2% | 5,6% | 4,9% |
| Hospedeiro com conteúdo | 5,9% | 1,0% | 1,0% | 0,2% |
| Nome vernáculo | 18,7% | 36,6% | 3,2% | 6,8% |
| Material-tipo | 11,1% | 2,5% | 2,9% | 2,1% |
| ZooBank | 2,3% | <0,1% | 1,2% | 0,4% |
| species_id | 0,9% | 0,3% | <0,1% | 0,1% |
| voucher_fauna (útil) | 5,1% | 0,6% | 1,3% | 0,3% |
| Distribuição totalmente vazia | 14,9% | 20,1% | 41,4% | 32,0% |

Diferem: subespécies aceitas têm mais forma de vida, substrato, vernáculo e texto de publicação; menos CSL, `origem`, hospedeiro, material-tipo, voucher e IDs externos.

## Campos sempre vazios

Zero preenchimento em aceitos, sinônimos e sem status:

| Coluna / tabela | Observação |
|---|---|
| `taxon_name_base.aff_cf`, `taxon_name_base.nec` | `nec` só tem `''`; `aff_cf` sempre NULL |
| `taxon_base.variante_ortografica_r_s_fk`, `taxon_base.grupo_fk` | sempre NULL |
| `dados_lista_brasil.id_lista_brasil`, `.tipo_primario`, `.publicacao_original_fk`, `.grupo_fk` | sempre NULL |
| `referencia_lista`, `voucher_lista`, `duplicata_lista`, `herbario`, `coletor`, `figura`, `figura_lista`, `imagem_lista`, `est`, `municipio` | tabelas com 0 linhas |
| `distribuicao_dom_biogeografico` | 1 linha no banco, nenhuma no universo |
| `secundario.referencia_paraneotipo_secunda`, `.hospedeiro_secundario`, `.referencia_hospedeiro_secundar` | sempre vazios |

Quase vazios (aceitos): `dados_lista_brasil.itis` (2 valores úteis; 6.975 strings `''`), `taxon_base.taxon_lista_node_fk` (5), `distribuicao_macrohabitat` (3), `distribuicao_marinha` (2), `distribuicao_hidrografica` (17), `primario.dna_voucher_primario` (143), `coletivo.dna_voucher_coletivo` (12), `secundario.dna_voucher_secundario` (94), `primario.referencia_neotipo_primario` (62).

## Consultas

```sql
-- Universo (executar uma vez por conexão; o banco é aberto read-only: file:dados/fauna.sqlite?mode=ro)
CREATE TEMP TABLE u AS
SELECT t.id AS tb, t.dados_lista_brasil_fk AS d, n.rank,
       CASE t.is_synonym WHEN 0 THEN 'A' WHEN 1 THEN 'S' ELSE 'N' END AS g,   -- A aceito, S sinônimo, N sem status
       t.taxon_name_base_fk AS nb
FROM taxon_base t JOIN taxon_name_base n ON n.id = t.taxon_name_base_fk
WHERE n.rank IN ('ESPECIE','SUB_ESPECIE');
CREATE INDEX temp.iu ON u(d);

-- Tabelas auxiliares de hospedeiro (acelera os EXISTS)
CREATE TEMP TABLE hv AS SELECT DISTINCT hospedeiro_fk k FROM hospedeiro_vegetal;
CREATE TEMP TABLE ha AS SELECT DISTINCT hospedeiro_fk k FROM animal_host_name_hospedeiro;
CREATE TEMP TABLE hf AS SELECT DISTINCT hospedeiro_fk k FROM hospedeiro_hospedeiros_animais;
CREATE INDEX temp.ihv ON hv(k); CREATE INDEX temp.iha ON ha(k); CREATE INDEX temp.ihf ON hf(k);

-- Denominadores (g × rank)
SELECT g, rank, COUNT(*) FROM u GROUP BY 1,2;

-- Coluna direta não vazia (substitua a condição; n = taxon_name_base, t = taxon_base, h = hub, di = distribuicao)
SELECT u.g, COUNT(*)
FROM u
LEFT JOIN dados_lista_brasil h ON h.id = u.d
LEFT JOIN taxon_name_base n    ON n.id = u.nb
LEFT JOIN taxon_base t         ON t.id = u.tb
LEFT JOIN distribuicao di      ON di.id = h.distribuicao_fk
WHERE n.autor IS NOT NULL AND trim(n.autor, ' '||char(9)||char(10)||char(13)) <> ''   -- 'não vazio'
GROUP BY u.g;
-- N:N / 1:N: troque a condição por
--   h.id IN (SELECT dados_lista_brasil_fk FROM dados_lista_brasil_forma_vida)
--   h.id IN (SELECT dados_lista_brasil_fk FROM nm_vernaculo)
--   h.id IN (SELECT dados_lista_brasil_fk FROM primario WHERE trim(coalesce(tipo_primario,''))<>'')
--   di.id IN (SELECT distribuicao_fk FROM distribuicao_abrangencia)

-- Hospedeiro: linha existe mas vazia vs com conteúdo
-- conteúdo  = h.hospedeiro_fk IN (SELECT k FROM hv) OR ... IN (SELECT k FROM ha) OR ... IN (SELECT k FROM hf)
SELECT u.g,
  SUM(h.hospedeiro_fk IS NOT NULL)                                                            AS linha,
  SUM(h.hospedeiro_fk IN (SELECT k FROM hv) OR h.hospedeiro_fk IN (SELECT k FROM ha)
      OR h.hospedeiro_fk IN (SELECT k FROM hf))                                              AS com_conteudo,
  SUM(h.hospedeiro_fk IN (SELECT id FROM hospedeiro WHERE indeterminado = 1))                 AS indeterminado
FROM u JOIN dados_lista_brasil h ON h.id = u.d
GROUP BY u.g;

-- Distribuição totalmente vazia: sem origem, endemismo, abrangência (UF/bacia/mar/país),
-- domínio (biogeográfico/marinho/epicontinental), macro-habitat e ambiente MARINHO/EPICONTINENTAL
SELECT u.g, COUNT(*)
FROM u JOIN dados_lista_brasil h ON h.id = u.d JOIN distribuicao di ON di.id = h.distribuicao_fk
WHERE di.origem IS NULL AND di.endemica_brasil IS NULL
  AND di.id NOT IN (SELECT distribuicao_fk FROM distribuicao_abrangencia)
  AND di.id NOT IN (SELECT distribuicao_fk FROM distribuicao_hidrografica)
  AND di.id NOT IN (SELECT distribuicao_fk FROM distribuicao_marinha)
  AND di.id NOT IN (SELECT distribuicao_fk FROM distribuicao_paises)
  AND di.id NOT IN (SELECT distribuicao_fk FROM distribuicao_dom_biogeografico)
  AND di.id NOT IN (SELECT distribuicao_fk FROM distribuicao_dom_bio_marinho)
  AND di.id NOT IN (SELECT distribuicao_fk FROM distribuicao_dom_bio_epicontin)
  AND di.id NOT IN (SELECT distribuicao_fk FROM distribuicao_macrohabitat)
  AND di.id NOT IN (SELECT x.distribuicao_fk FROM ambiente_distribuicao x
                    JOIN ambiente a ON a.id = x.ambiente_fk WHERE a.tipo IN ('MARINHO','EPICONTINENTAL'))
GROUP BY u.g;

-- Parasita × hospedeiro com conteúdo
WITH f AS (
  SELECT u.g, u.d,
    EXISTS (SELECT 1 FROM dados_lista_brasil_forma_vida x JOIN forma_vida fv ON fv.id = x.forma_vida_fk
            WHERE x.dados_lista_brasil_fk = u.d
              AND fv.tipo IN ('ECTOPARASITO','ENDOPARASITO','ECTOPARASITOIDE','ENDOPARASITOIDE','HIPERPARASITOIDE')) AS parasita,
    (h.hospedeiro_fk IN (SELECT k FROM hv) OR h.hospedeiro_fk IN (SELECT k FROM ha)
     OR h.hospedeiro_fk IN (SELECT k FROM hf)) AS hosp
  FROM u JOIN dados_lista_brasil h ON h.id = u.d)
SELECT g, parasita, COALESCE(hosp,0) AS hosp, COUNT(*) FROM f GROUP BY 1,2,3;

-- Ambiente × domínios (MARINHO × dom_bio_marinho; EPICONTINENTAL × dom_bio_epicontinental)
SELECT u.g, a.tipo,
  COUNT(*)                                                                             AS n,
  SUM(di.id IN (SELECT distribuicao_fk FROM distribuicao_dom_bio_marinho))              AS com_dom_marinho,
  SUM(di.id IN (SELECT distribuicao_fk FROM distribuicao_dom_bio_epicontin))            AS com_dom_epi,
  SUM(di.id IN (SELECT distribuicao_fk FROM distribuicao_hidrografica))                 AS com_bacias
FROM u JOIN dados_lista_brasil h ON h.id = u.d JOIN distribuicao di ON di.id = h.distribuicao_fk
JOIN ambiente_distribuicao ad ON ad.distribuicao_fk = di.id JOIN ambiente a ON a.id = ad.ambiente_fk
GROUP BY u.g, a.tipo;

-- Publicação: texto útil (função util(), abaixo) × objeto CSL em campos_json
SELECT u.g,
  SUM(util(h.bibliografia_referencia) = 1)                                           AS texto,
  SUM(json_type(h.campos_json,'$.bibliografia.main') = 'object')                      AS csl,
  SUM(util(h.bibliografia_referencia) = 1 AND json_type(h.campos_json,'$.bibliografia.main') = 'object') AS ambos,
  SUM(NOT COALESCE(util(h.bibliografia_referencia) = 1 OR json_type(h.campos_json,'$.bibliografia.main') = 'object', 0)) AS nenhum
FROM u JOIN dados_lista_brasil h ON h.id = u.d GROUP BY u.g;
```

```python
# util(x): 1 se o texto HTML (escapado, ex. '&lt;p&gt;&amp;nbsp;&lt;/p&gt;') tem conteúdo após remover tags e entidades
import sqlite3, html, re
con = sqlite3.connect("file:dados/fauna.sqlite?mode=ro", uri=True)
def util(x):
    if x is None: return 0
    s = html.unescape(x); s = re.sub(r'<[^>]*>', '', s)
    return int(html.unescape(s).replace('\xa0', ' ').strip() != '')
con.create_function("util", 1, util, deterministic=True)
```
