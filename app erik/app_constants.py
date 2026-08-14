import os
import sys


APP_NAME = "Ocorrencia_SX"
APP_DB_FILENAME = "ocorrencias_ne.db"


def _get_app_bundle_dir():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def _get_app_data_dir():
    local_appdata = os.environ.get("LOCALAPPDATA")
    if local_appdata:
        return os.path.join(local_appdata, APP_NAME)

    user_profile = os.path.expanduser("~")
    return os.path.join(user_profile, "Documents", APP_NAME)


APP_BUNDLE_DIR = _get_app_bundle_dir()
APP_DATA_DIR = _get_app_data_dir()
DB_NAME = os.path.join(APP_DATA_DIR, APP_DB_FILENAME)
LOGISTICA_EMAIL = "Logistica.dca@friboi.com.br"
APP_TITLE = "Ocorrência SX"

MOTIVOS_OCORRENCIA = [
    "DEVOLUCAO TOTAL",
    "DEVOLUCAO PARCIAL",
    "QUEBRA DE PESO",
    "CLIENTE FECHADO",
    "CLIENTE SEM CARIMBO",
    "DEMORA NO RECEBIMENTO",
    "LOCALIZACAO",
    "OUTROS",
]

MOTIVOS_DEVOLUCAO_AUTOMATICA = {"DEVOLUCAO TOTAL"}

MOTIVOS_COM_DEVOLUCAO = {"DEVOLUCAO TOTAL", "DEVOLUCAO PARCIAL"}
MOTIVOS_COM_QUEBRA = {"DEVOLUCAO PARCIAL", "QUEBRA DE PESO"}

MOTIVOS_SEM_COR = {"DEVOLUCAO TOTAL", "DEVOLUCAO PARCIAL"}

MOTIVO_COLORS = {
    "QUEBRA DE PESO": "#F59E0B",
    "CLIENTE FECHADO": "#78716C",
    "CLIENTE SEM CARIMBO": "#2563EB",
    "DEMORA NO RECEBIMENTO": "#4F46E5",
    "LOCALIZACAO": "#EF4444",
    "OUTROS": "#0F766E",
}

MOTIVOS_QUE_EXIGEM_DESCRICAO = set(MOTIVOS_OCORRENCIA)

MOTIVOS_NOTIFICACAO_FALTA = [
    "FALTA DE CAIXAS/PEÇAS NA ENTREGA",
    "TEMPERATURA INADEQUADA DURANTE O TRANSPORTE",
    "ATRASO NA ENTREGA",
    "ATRASO NA ENTREGA - RAVEX",
    "TEMPERATURA INADEQUADA - RAVEX",
    "ENTREGA NO LOCAL ERRADO.",
]

UNIDADES_NOTIFICACAO_FALTA = [
    "DCA",
    "GCP",
    "CROSS (OUTROS)",
]

TRANSPORTADORAS_POR_PLACA = {
    "BSY2F83": "TRANSNOVA TRANSPORTES E LOGISTICA LTDA",
    "BYJ7H32": "TRANSNOVA TRANSPORTES E LOGISTICA LTDA",
    "BZL3B46": "RUDINEE MARQUES SANTANA TRANSPORTES EIRELI",
    "CUL3D06": "TRANSNOVA TRANSPORTES E LOGISTICA LTDA",
    "DRS1J21": "FORCE LOG TRANSPORTE RODOVIARIO DE CARGAS LTDA",
    "DZL9H23": "TRANSNOVA TRANSPORTES E LOGISTICA LTDA",
    "ENN7911": "LC DE SOUSA SILVA TRANSPORTES",
    "ETA7145": "DAC TRANSPORTES LTDA",
    "FFW5A89": "FORCE LOG TRANSPORTE RODOVIARIO DE CARGAS LTDA",
    "FHO9E42": "TRANSNOVA TRANSPORTES E LOGISTICA LTDA",
    "FMH8F24": "FORCE LOG TRANSPORTE RODOVIARIO DE CARGAS LTDA",
    "FMO4A61": "TRANSNOVA TRANSPORTES E LOGISTICA LTDA",
    "FPM1E12": "KOREA TRANSPORTES LTDA",
    "FPV4J04": "TRANSNOVA TRANSPORTES E LOGISTICA LTDA",
    "FYK0J54": "TRANSNOVA TRANSPORTES E LOGISTICA LTDA",
    "FYQ9G47": "KOREA TRANSPORTES LTDA",
    "FZE4H66": "KOREA TRANSPORTES LTDA",
    "FZF6G16": "RUDINEE MARQUES SANTANA TRANSPORTES EIRELI",
    "FZW6H76": "RUDINEE MARQUES SANTANA TRANSPORTES EIRELI",
    "GAF2D09": "KOREA TRANSPORTES LTDA",
    "GAY9B45": "TRANSNOVA TRANSPORTES E LOGISTICA LTDA",
    "GEW5I67": "CARGO FRIO TRANSPORTE E LOGISTICA LTDA",
    "GFE3J84": "TRANSNOVA TRANSPORTES E LOGISTICA LTDA",
    "GGH4B86": "RUDINEE MARQUES SANTANA TRANSPORTES EIRELI",
}

RESUMO_PADRAO_NOTIFICACAO_FALTA = (
    "PREZADO TRANSPORTADOR VOCE ESTA RECEBENDO UM ALERTA DE RECLAMACAO NO ATO DA ENTREGA: "
    "Falta de caixa/peso evidenciado no ato da entrega. Veiculo saiu lacrado e pesado do Armazem, "
    "as caixas sao lacradas com fitas de arquear e pesadas. A estocagem e embarque sao filmados. "
    "Estamos auditando todos os processos e logo que identificado onde os desvios foram gerados "
    "iremos retornar com o desconto do prejuizo."
)

# Override de textos com acentuação corrigida para a nova funcionalidade.
APP_TITLE = "Ocorrência SX"
MOTIVOS_NOTIFICACAO_FALTA = [
    "FALTA DE CAIXAS/PEÇAS NA ENTREGA",
    "TEMPERATURA INADEQUADA DURANTE O TRANSPORTE",
    "ATRASO NA ENTREGA",
    "ATRASO NA ENTREGA - RAVEX",
    "TEMPERATURA INADEQUADA - RAVEX",
    "ENTREGA NO LOCAL ERRADO.",
]
RESUMO_PADRAO_NOTIFICACAO_FALTA = (
    "PREZADO TRANSPORTADOR, VOCÊ ESTÁ RECEBENDO UM ALERTA DE RECLAMAÇÃO NO ATO DA ENTREGA: "
    "falta de caixa/peso evidenciada no ato da entrega. O veículo saiu lacrado e pesado do armazém, "
    "as caixas são lacradas com fitas de arquear e pesadas. A estocagem e o embarque são filmados. "
    "Estamos auditando todos os processos e, logo que identificado onde os desvios foram gerados, "
    "retornaremos com o desconto do prejuízo."
)

APP_TITLE = "Ocorr\u00eancia SX"
MOTIVOS_NOTIFICACAO_FALTA = [
    "FALTA DE CAIXAS/PE\u00c7AS NA ENTREGA",
    "TEMPERATURA INADEQUADA DURANTE O TRANSPORTE",
    "ATRASO NA ENTREGA",
    "ATRASO NA ENTREGA - RAVEX",
    "TEMPERATURA INADEQUADA - RAVEX",
    "ENTREGA NO LOCAL ERRADO.",
]
RESUMO_PADRAO_NOTIFICACAO_FALTA = (
    "PREZADO TRANSPORTADOR, VOC\u00ca EST\u00c1 RECEBENDO UM ALERTA DE RECLAMA\u00c7\u00c3O NO ATO DA ENTREGA: "
    "falta de caixa/peso evidenciada no ato da entrega. O ve\u00edculo saiu lacrado e pesado do armaz\u00e9m, "
    "as caixas s\u00e3o lacradas com fitas de arquear e pesadas. A estocagem e o embarque s\u00e3o filmados. "
    "Estamos auditando todos os processos e, logo que identificado onde os desvios foram gerados, "
    "retornaremos com o desconto do preju\u00edzo."
)

IMPORT_LOG_DIR = os.path.join(APP_DATA_DIR, "logs")
IMPORT_BACKUP_DIR = os.path.join(APP_DATA_DIR, "backups")

STYLE_SHEET = """

QMainWindow {
    background-color: #F0F4F8;
}

QTabWidget::pane {
    border: 1px solid #CED4DA;
    background-color: white;
}

QTabBar::tab {
    background: #E9ECEF;
    border: 1px solid #CED4DA;
    border-bottom: none;
    padding: 10px 20px;
    color: #495057;
    font-weight: bold;
}

QTabBar::tab:selected {
    background: white;
    border-color: #CED4DA;
    border-bottom-color: white;
    color: #007BFF;
    margin-bottom: -1px;
}

QTabBar::tab:hover:!selected {
    background: #DEE2E6;
}

QTreeWidget {
    background-color: white;
    alternate-background-color: #F8F9FA;
    color: #212529;
    border: 1px solid #CED4DA;
    selection-background-color: #B3D4FF;
    selection-color: #212529;
    font-size: 14px;
}

QTreeWidget::header {
    background-color: #007BFF;
    color: white;
    border: 1px solid #007BFF;
    padding: 8px;
    font-weight: bold;
    font-size: 14px;
}

QLineEdit, QTextEdit, QComboBox, QDateEdit {
    background-color: white;
    border: 1px solid #CED4DA;
    padding: 8px;
    border-radius: 4px;
    color: #212529;
}

QLineEdit:focus, QTextEdit:focus, QComboBox:focus, QDateEdit:focus {
    border: 2px solid #007BFF;
}

QPushButton#btn_principal {
    background-color: #007BFF;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 5px;
    font-weight: bold;
    min-width: 100px;
    font-size: 14px;
}

QPushButton#btn_principal:hover {
    background-color: #0056b3;
}

QPushButton#btn_adicionar {
    background-color: #28A745;
    color: white;
    border: none;
    padding: 8px 15px;
    border-radius: 4px;
    font-weight: bold;
}

QPushButton#btn_adicionar:hover {
    background-color: #1e7e34;
}

QPushButton#btn_deletar {
    background-color: #DC3545;
    color: white;
    border: none;
    padding: 8px 15px;
    border-radius: 4px;
    font-weight: bold;
}

QPushButton#btn_deletar:hover {
    background-color: #bd2130;
}

QPushButton:!hover {
    background-color: #6C757D;
    color: white;
    border: none;
    padding: 8px 15px;
    border-radius: 4px;
    font-weight: bold;
}

QPushButton:hover {
    background-color: #5A6268;
}

QLabel {
    color: #212529;
    font-size: 14px;
}

QLabel#titulo {
    font-size: 20px;
    font-weight: bold;
    color: #007BFF;
    padding-bottom: 10px;
}

QLabel#subtitulo {
    font-size: 16px;
    font-weight: bold;
    color: #495057;
    padding-top: 5px;
}

QGroupBox {
    border: 1px solid #CED4DA;
    border-radius: 5px;
    margin-top: 20px;
    background-color: white;
}

QGroupBox::title {
    subcontrol-origin: margin;
    subcontrol-position: top left;
    padding: 0 10px;
    background-color: #F8F9FA;
    color: #007BFF;
    font-weight: bold;
    font-size: 14px;
    margin-left: 5px;
}

QScrollArea {
    border: none;
}

QFrame#frame_dashboard, QFrame#frame_principal {
    background-color: white;
    border-radius: 5px;
    padding: 10px;
    border: 1px solid #DEE2E6;
}

QGroupBox#group_compacto {
    border: 1px solid #D9E2EC;
    border-radius: 10px;
    margin-top: 16px;
    background-color: #F8FBFD;
}

QGroupBox#group_compacto::title {
    background-color: #EFF6FF;
    color: #0F172A;
    padding: 3px 10px;
    border-radius: 6px;
    margin-left: 8px;
}

QFrame#info_card {
    background-color: #FFFFFF;
    border: 1px solid #D8E1EA;
    border-radius: 12px;
}

QFrame#info_card:hover {
    border: 1px solid #B6C4D4;
}

QLabel#info_card_title {
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

QLabel#info_card_value {
    font-size: 15px;
    font-weight: bold;
    color: #0F172A;
    line-height: 1.35em;
}

QLabel#status_box {
    background-color: #F8FAFC;
    border: 1px solid #D8E1EA;
    border-radius: 10px;
    padding: 12px;
}

QMessageBox {
    background-color: #F0F4F8;
    color: #212529;
}
"""
