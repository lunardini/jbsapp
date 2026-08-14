import io
import os
from html import unescape
from html.parser import HTMLParser

import pandas as pd


class _HTMLTableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.current_cell = []
        self.current_row = []
        self.rows = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "table" and not self.in_table:
            self.in_table = True
            return
        if not self.in_table:
            return
        if tag == "tr":
            self.in_row = True
            self.current_row = []
        elif tag in {"td", "th"} and self.in_row:
            self.in_cell = True
            self.current_cell = []
        elif tag == "br" and self.in_cell:
            self.current_cell.append("\n")

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "table" and self.in_table:
            self.in_table = False
            return
        if not self.in_table:
            return
        if tag in {"td", "th"} and self.in_cell:
            cell_text = unescape("".join(self.current_cell)).strip()
            self.current_row.append(" ".join(cell_text.split()))
            self.current_cell = []
            self.in_cell = False
        elif tag == "tr" and self.in_row:
            if any(str(cell).strip() for cell in self.current_row):
                self.rows.append(self.current_row)
            self.current_row = []
            self.in_row = False

    def handle_data(self, data):
        if self.in_cell:
            self.current_cell.append(data)


def _dataframe_from_html_text(raw_text):
    parser = _HTMLTableParser()
    parser.feed(raw_text)
    rows = [row for row in parser.rows if any(str(cell).strip() for cell in row)]
    if len(rows) < 2:
        raise ValueError("Tabela HTML sem cabecalho ou sem linhas de dados.")

    max_columns = max(len(row) for row in rows)
    normalized_rows = [row + [""] * (max_columns - len(row)) for row in rows]
    header = normalized_rows[0]
    data_rows = normalized_rows[1:]
    return pd.DataFrame(data_rows, columns=header)


def _read_html_table_file(filepath):
    html_errors = []
    for encoding in ("utf-8", "latin1"):
        try:
            with open(filepath, "r", encoding=encoding) as html_file:
                raw_text = html_file.read()
            return _dataframe_from_html_text(raw_text)
        except Exception as exc:
            html_errors.append(f"{encoding}: {exc}")
    raise ValueError("Falha ao ler tabela HTML: " + " | ".join(html_errors))


def _looks_like_html_table(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as probe_file:
            prefix = probe_file.read(512).lower()
    except UnicodeDecodeError:
        try:
            with open(filepath, "r", encoding="latin1") as probe_file:
                prefix = probe_file.read(512).lower()
        except Exception:
            return False
    except Exception:
        return False

    return "<table" in prefix or "<html" in prefix or "<thead" in prefix or "<tbody" in prefix


def normalize_dataframe_columns(df):
    df.columns = (
        df.columns.astype(str)
        .str.strip()
        .str.lower()
        .str.normalize("NFKD")
        .str.encode("ascii", errors="ignore")
        .str.decode("utf-8")
    )
    return df


def find_first_column(df, column_candidates):
    df_cols = df.columns.tolist()
    for column_name in column_candidates:
        if column_name in df_cols:
            return column_name
    return None


def read_table_file(filepath):
    if not filepath or not os.path.exists(filepath):
        raise FileNotFoundError("Arquivo nao encontrado.")

    lower_path = filepath.lower()
    if lower_path.endswith(".xlsx"):
        excel_errors = []
        for engine in ("openpyxl", None):
            try:
                kwargs = {"engine": engine} if engine else {}
                return pd.read_excel(filepath, **kwargs)
            except Exception as exc:
                excel_errors.append(str(exc))
        raise ValueError("Falha ao abrir arquivo .xlsx: " + " | ".join(excel_errors))

    if lower_path.endswith(".xls"):
        if _looks_like_html_table(filepath):
            return _read_html_table_file(filepath)

        excel_errors = []
        for engine in ("xlrd", "openpyxl", None):
            try:
                kwargs = {"engine": engine} if engine else {}
                return pd.read_excel(filepath, **kwargs)
            except Exception as exc:
                excel_errors.append(f"{engine or 'auto'}: {exc}")
        try:
            return _read_html_table_file(filepath)
        except Exception as exc:
            excel_errors.append(f"html: {exc}")
        for kwargs in (
            {"sep": ";", "encoding": "latin1"},
            {"sep": "\t", "encoding": "latin1"},
            {"sep": ",", "encoding": "latin1"},
            {"sep": ";", "encoding": "utf-8"},
            {"sep": "\t", "encoding": "utf-8"},
            {"sep": ",", "encoding": "utf-8"},
        ):
            try:
                df = pd.read_csv(filepath, **kwargs)
                if len(df.columns) > 1:
                    return df
            except Exception as exc:
                excel_errors.append(f"csv: {exc}")
        raise ValueError(
            "Falha ao abrir arquivo .xls. "
            "Verifique se a dependencia 'xlrd' esta instalada. "
            + " | ".join(excel_errors)
        )

    if lower_path.endswith(".csv"):
        for kwargs in (
            {"sep": ";", "encoding": "latin1"},
            {"sep": ",", "encoding": "latin1"},
            {"sep": ";", "encoding": "utf-8"},
            {"sep": ",", "encoding": "utf-8"},
            {"encoding": "latin1"},
            {"encoding": "utf-8"},
        ):
            try:
                df = pd.read_csv(filepath, **kwargs)
                if len(df.columns) > 1 or "sep" not in kwargs:
                    return df
            except Exception:
                continue

    raise ValueError("Formato de arquivo nao suportado. Use .xlsx, .xls ou .csv.")


def read_excel_sheets(filepath):
    if not filepath or not os.path.exists(filepath):
        raise FileNotFoundError("Arquivo nao encontrado.")

    lower_path = filepath.lower()
    if not lower_path.endswith((".xlsx", ".xls")):
        raise ValueError("Formato de arquivo nao suportado para leitura de abas.")

    if lower_path.endswith(".xls") and _looks_like_html_table(filepath):
        return {"descricao": _read_html_table_file(filepath)}

    excel_errors = []
    for engine in ("openpyxl", "xlrd", None):
        try:
            kwargs = {"engine": engine} if engine else {}
            workbook = pd.read_excel(filepath, sheet_name=None, **kwargs)
            return workbook
        except Exception as exc:
            excel_errors.append(f"{engine or 'auto'}: {exc}")

    raise ValueError("Falha ao abrir abas do Excel: " + " | ".join(excel_errors))


def read_table_text(raw_text):
    for kwargs in (
        {"sep": "\t", "encoding": "utf-8"},
        {"sep": ";", "encoding": "latin1"},
        {"sep": ",", "encoding": "latin1"},
        {"sep": ";", "encoding": "utf-8"},
        {"sep": ",", "encoding": "utf-8"},
    ):
        try:
            df = pd.read_csv(io.StringIO(raw_text), **kwargs)
            if len(df.columns) > 1:
                return df
        except Exception:
            continue
    if "<table" in raw_text.lower():
        return _dataframe_from_html_text(raw_text)
    raise ValueError("Dados colados invalidos ou vazios.")


def parse_decimal_input(raw_value):
    text = str(raw_value or "").strip()
    if not text:
        return 0.0

    text = text.replace("R$", "").replace(" ", "")
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        text = text.replace(".", "").replace(",", ".")

    return float(text)


def clear_layout(layout):
    while layout.count():
        child = layout.takeAt(0)
        if child.widget():
            child.widget().deleteLater()
