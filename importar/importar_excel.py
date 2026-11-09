#!/usr/bin/env python3
"""Importa los clientes y las compras del Excel de Joyería Torres Torres a Supabase.

Uso (ver importar/README.md):
    python importar_excel.py clientes.xlsx              # solo revisa, no guarda nada
    python importar_excel.py clientes.xlsx --aplicar    # revisa y guarda en Supabase

Siempre deja un reporte en Excel (reporte_importacion.xlsx) con los problemas
encontrados y la comparación entre lo que dice el Excel y lo que calcula el
sistema con las reglas del programa de lealtad.
"""

from __future__ import annotations

import argparse
import getpass
import os
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd

ZONA = ZoneInfo("America/Monterrey")
LOTE = 200  # filas por envío a Supabase

# Reglas iniciales; con --aplicar se leen de la tabla configuracion/niveles.
REGLAS_INICIALES = {
    "bloque_pesos": Decimal(10),
    "valor_punto": Decimal("0.25"),
    "vigencia_meses": 6,
    "niveles": [
        {"nombre": "Plata", "desde": Decimal(0), "puntos_por_bloque": 1},
        {"nombre": "Oro", "desde": Decimal(2000), "puntos_por_bloque": 2},
        {"nombre": "Diamante", "desde": Decimal(5000), "puntos_por_bloque": 2},
    ],
}

# Palabras que se dejan en minúscula al corregir nombres.
PARTICULAS = {"de", "del", "la", "las", "los", "y", "e", "da", "van", "von"}


# --- Utilidades ---------------------------------------------------------------


def sin_acentos(texto) -> str:
    texto = unicodedata.normalize("NFKD", str(texto))
    return "".join(c for c in texto if not unicodedata.combining(c)).lower().strip()


def vacio(valor) -> bool:
    if valor is None:
        return True
    if isinstance(valor, float) and pd.isna(valor):
        return True
    if valor is pd.NaT:
        return True
    return isinstance(valor, str) and valor.strip() == ""


def texto(valor) -> str:
    if vacio(valor):
        return ""
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    return re.sub(r"\s+", " ", str(valor)).strip()


def leer_id(valor) -> int | None:
    """'TT.1105', 'tt-1105' o 1105 -> 1105."""
    digitos = re.sub(r"\D", "", texto(valor))
    return int(digitos) if digitos else None


def leer_fecha(valor) -> date | None:
    """Fechas de Excel o texto dd/mm/aaaa. El 00/01/1900 de Excel cuenta como vacío."""
    if vacio(valor):
        return None
    if isinstance(valor, (int, float)):
        if valor <= 0:
            return None
        valor = datetime(1899, 12, 30) + timedelta(days=float(valor))
    if isinstance(valor, datetime):
        d = valor.date()
    elif isinstance(valor, date):
        d = valor
    else:
        s = str(valor).strip()
        m = re.fullmatch(r"(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})", s)
        if not m:
            raise ValueError(f"fecha no reconocida: {s!r}")
        dia, mes, anio = (int(x) for x in m.groups())
        if dia == 0:
            return None
        if anio < 100:
            anio += 2000 if anio < 50 else 1900
        d = date(anio, mes, dia)
    return None if d.year < 1901 else d


def leer_dinero(valor) -> Decimal | None:
    if vacio(valor):
        return None
    if isinstance(valor, (int, float)):
        return Decimal(str(valor))
    s = re.sub(r"[^\d.\-]", "", str(valor))
    return Decimal(s) if s not in ("", "-", ".") else None


def normalizar_telefono(valor) -> str:
    """Igual que normalizar_telefono() en la base: 10 dígitos -> 52 + número."""
    d = re.sub(r"\D", "", texto(valor))
    if len(d) == 10:
        return "52" + d
    if len(d) == 13 and d.startswith("521"):
        return "52" + d[3:]
    return d


def corregir_nombre(nombre: str) -> str:
    palabras = nombre.split(" ")
    salida = []
    for i, p in enumerate(palabras):
        if i > 0 and p.lower() in PARTICULAS:
            salida.append(p.lower())
        else:
            salida.append("-".join(x[:1].upper() + x[1:].lower() for x in p.split("-")))
    return " ".join(salida)


def a_las_doce(d: date, orden: int = 0) -> datetime:
    """Mediodía en Monterrey (evita que la fecha cambie por zona horaria);
    los segundos conservan el orden de las filas del mismo día."""
    return datetime.combine(d, time(12, 0), ZONA) + timedelta(seconds=orden)


def sumar_meses(f: datetime, meses: int) -> datetime:
    mes = f.month - 1 + meses
    anio, mes = f.year + mes // 12, mes % 12 + 1
    dias = [31, 29 if anio % 4 == 0 and (anio % 100 or anio % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return f.replace(year=anio, month=mes, day=min(f.day, dias[mes - 1]))


# --- Lectura del Excel -------------------------------------------------------

# Cada columna se reconoce por cómo empieza su encabezado (sin acentos ni mayúsculas),
# así funcionan encabezados cortados como "Fecha regist" o "Pesos para can".
COLUMNAS_CLIENTES = {
    "id": ["id"],
    "nombre": ["nombre"],
    "telefono": ["telefono", "tel", "celular"],
    "cumple": ["cumple", "fecha de nac", "nacimiento"],
    "fecha_registro": ["fecha regist", "fecha de regist", "fecha alta"],
    "empleada": ["=registro", "=registro por", "registrado por", "registro por", "empleada", "vendedora"],
    "total": ["total compr", "total"],
    "nivel": ["nivel"],
    "ultima_compra": ["fecha ultima", "ultima compra", "ultima"],
    "puntos": ["puntos"],
    "pesos": ["pesos"],
    "notas": ["notas", "nota", "observ"],
}
COLUMNAS_COMPRAS = {
    "id": ["id"],
    "fecha": ["fecha"],
    "nombre": ["nombre"],
    "sucursal": ["sucursal"],
    "monto": ["monto", "total", "importe"],
    "ticket": ["foto ticket", "folio", "ticket"],
    "nivel": ["nivel"],
    "puntos": ["puntos generados", "puntos gan"],
    "sube": ["sube"],
}


def buscar_columnas(encabezados: list[str], reglas: dict[str, list[str]]) -> dict[str, str]:
    normales = {h: sin_acentos(h) for h in encabezados}
    elegidas: dict[str, str] = {}
    for campo, prefijos in reglas.items():
        for prefijo in prefijos:
            for h, n in normales.items():
                if h in elegidas.values():
                    continue
                # "=texto" pide el encabezado exacto ("Registro", no "Fecha registro").
                if (n == prefijo[1:]) if prefijo.startswith("=") else n.startswith(prefijo):
                    elegidas[campo] = h
                    break
            if campo in elegidas:
                break
    return elegidas


def leer_hoja(archivo: Path, hoja: str) -> pd.DataFrame:
    """Lee una hoja buscando la fila de encabezados en las primeras 15 filas."""
    crudo = pd.read_excel(archivo, sheet_name=hoja, header=None, dtype=object)
    for i in range(min(15, len(crudo))):
        fila = [sin_acentos(x) for x in crudo.iloc[i] if not vacio(x)]
        if any(x.startswith("id") for x in fila) and any(x.startswith("nombre") for x in fila):
            df = crudo.iloc[i + 1 :].copy()
            df.columns = [texto(x) or f"col{j}" for j, x in enumerate(crudo.iloc[i])]
            df["_fila"] = range(i + 2, i + 2 + len(df))  # número de fila como lo ve Excel
            return df
    raise SystemExit(f"No encontré los encabezados (ID, Nombre...) en la hoja «{hoja}».")


def elegir_hojas(archivo: Path, hoja_clientes: str | None, hoja_compras: str | None) -> tuple[str, str]:
    hojas = pd.ExcelFile(archivo).sheet_names
    if hoja_clientes and hoja_compras:
        return hoja_clientes, hoja_compras
    for h in hojas:
        try:
            enc = [sin_acentos(c) for c in leer_hoja(archivo, h).columns]
        except SystemExit:
            continue
        if not hoja_clientes and any(c.startswith("telefono") for c in enc):
            hoja_clientes = h
        elif not hoja_compras and any(c.startswith("sucursal") for c in enc) and any(c.startswith("monto") for c in enc):
            hoja_compras = h
    if not hoja_clientes or not hoja_compras:
        raise SystemExit(
            "No pude reconocer las hojas. Hojas del archivo: " + ", ".join(hojas)
            + "\nIndícalas con --hoja-clientes \"...\" --hoja-compras \"...\""
        )
    return hoja_clientes, hoja_compras


# --- Revisión ----------------------------------------------------------------


@dataclass
class Problemas:
    filas: list[dict] = field(default_factory=list)

    def agregar(self, tipo: str, hoja: str, fila, id_cliente, mensaje: str):
        self.filas.append({"Tipo": tipo, "Hoja": hoja, "Fila": fila, "ID cliente": formato_id(id_cliente), "Problema": mensaje})

    def error(self, *a):
        self.agregar("NO SE IMPORTA", *a)

    def aviso(self, *a):
        self.agregar("Revisar", *a)


def formato_id(i) -> str:
    return f"TT.{i}" if isinstance(i, int) else texto(i)


def revisar_clientes(df: pd.DataFrame, col: dict, hoja: str, prob: Problemas, corregir: bool) -> dict[int, dict]:
    clientes: dict[int, dict] = {}
    telefonos: dict[str, int] = {}
    for _, r in df.iterrows():
        fila = r["_fila"]
        g = lambda c: r[col[c]] if c in col else None  # noqa: E731
        id_ = leer_id(g("id"))
        nombre = texto(g("nombre"))
        telefono_crudo = texto(g("telefono"))
        if id_ is None and not nombre and not telefono_crudo:
            continue  # fila vacía
        if id_ is None:
            prob.error(hoja, fila, None, f"Cliente «{nombre}» sin ID")
            continue
        if id_ in clientes:
            prob.error(hoja, fila, id_, f"ID repetido (ya está en la fila {clientes[id_]['fila']})")
            continue
        if not nombre:
            prob.error(hoja, fila, id_, "Sin nombre")
            continue
        telefono = normalizar_telefono(telefono_crudo)
        if not telefono_crudo:
            prob.error(hoja, fila, id_, f"«{nombre}» no tiene teléfono (el sistema lo pide para la tarjeta)")
            continue
        if not re.fullmatch(r"52\d{10}", telefono):
            prob.error(hoja, fila, id_, f"Teléfono no válido: {telefono_crudo!r} (debe tener 10 dígitos)")
            continue
        if telefono in telefonos:
            prob.error(hoja, fila, id_, f"Teléfono repetido con TT.{telefonos[telefono]}")
            continue

        try:
            cumple = leer_fecha(g("cumple"))
        except ValueError as e:
            prob.aviso(hoja, fila, id_, f"Cumpleaños no se entiende ({e}); se deja vacío")
            cumple = None
        try:
            registro = leer_fecha(g("fecha_registro"))
        except ValueError as e:
            prob.aviso(hoja, fila, id_, f"Fecha de registro no se entiende ({e})")
            registro = None
        try:
            ultima = leer_fecha(g("ultima_compra"))
        except ValueError:
            ultima = None

        nombre_final = corregir_nombre(nombre) if corregir else nombre
        telefonos[telefono] = id_
        clientes[id_] = {
            "fila": fila,
            "id": id_,
            "nombre": nombre_final,
            "nombre_excel": nombre,
            "telefono": telefono,
            "cumple": cumple,
            "registro": registro,
            "empleada": texto(g("empleada")),
            "notas": texto(g("notas")),
            "excel_total": leer_dinero(g("total")),
            "excel_nivel": texto(g("nivel")),
            "excel_ultima": ultima,
            "excel_puntos": leer_dinero(g("puntos")),
            "excel_pesos": leer_dinero(g("pesos")),
            "compras": [],
        }
    return clientes


def revisar_compras(df, col, hoja, prob: Problemas, clientes: dict[int, dict], sucursales: dict[str, int]) -> list[dict]:
    compras = []
    tickets: dict[tuple[int, str], int] = {}
    for orden, (_, r) in enumerate(df.iterrows()):
        fila = r["_fila"]
        g = lambda c: r[col[c]] if c in col else None  # noqa: E731
        id_ = leer_id(g("id"))
        monto = leer_dinero(g("monto"))
        ticket = texto(g("ticket"))
        sucursal = texto(g("sucursal"))
        if id_ is None and not ticket and not sucursal and not monto:
            continue  # fila vacía (aunque tenga fórmulas como "Puntos x $10")
        if id_ is None:
            prob.error(hoja, fila, None, "Compra sin ID de cliente")
            continue
        if id_ not in clientes:
            prob.error(hoja, fila, id_, "El cliente no está (o no se importa) en la hoja de clientes")
            continue
        try:
            fecha = leer_fecha(g("fecha"))
        except ValueError as e:
            fecha, motivo = None, str(e)
        else:
            motivo = "vacía"
        if fecha is None:
            prob.error(hoja, fila, id_, f"Fecha de compra {motivo}")
            continue
        suc_id = sucursales.get(sin_acentos(sucursal))
        if suc_id is None:
            prob.error(hoja, fila, id_, f"Sucursal desconocida: «{sucursal}»")
            continue
        if monto is None or monto <= 0:
            prob.error(hoja, fila, id_, f"Monto vacío o en cero: {texto(g('monto'))!r}")
            continue
        if not ticket:
            prob.error(hoja, fila, id_, "Sin folio de ticket")
            continue
        clave = (suc_id, ticket)
        if clave in tickets:
            prob.error(hoja, fila, id_, f"Folio {ticket} repetido en {sucursal} (ya está en la fila {tickets[clave]})")
            continue
        tickets[clave] = fila

        cli = clientes[id_]
        nombre = texto(g("nombre"))
        if nombre and sin_acentos(re.sub(r"\s+", " ", nombre)) != sin_acentos(cli["nombre_excel"]):
            prob.aviso(hoja, fila, id_, f"El nombre «{nombre}» no coincide con la hoja de clientes («{cli['nombre_excel']}»)")
        compra = {
            "fila": fila,
            "cliente_id": id_,
            "fecha": a_las_doce(fecha, orden),
            "sucursal_id": suc_id,
            "total": monto,
            "ticket": ticket,
            "excel_puntos": leer_dinero(g("puntos")),
            "excel_nivel": texto(g("nivel")),
            "excel_sube": texto(g("sube")),
        }
        compras.append(compra)
        cli["compras"].append(compra)
    return compras


# --- Reglas del programa de lealtad (igual que recorrer_cliente en la base) ---


def simular(cli: dict, reglas: dict, hoy: datetime) -> dict:
    niv = reglas["niveles"]
    i, acum, puntos, vence_desde, ultima = 0, Decimal(0), 0, None, None

    def vencer(hasta):
        nonlocal i, acum, puntos, vence_desde
        if vence_desde and sumar_meses(vence_desde, reglas["vigencia_meses"]) <= hasta and puntos + acum > 0:
            puntos = 0
            if i > 0:
                i -= 1
                acum = niv[i]["desde"]
            vence_desde = None

    for c in sorted(cli["compras"], key=lambda c: c["fecha"]):
        vencer(c["fecha"])
        bloques = (c["total"] / reglas["bloque_pesos"]).quantize(Decimal(1), ROUND_HALF_UP)
        c["sis_puntos"] = int(bloques) * niv[i]["puntos_por_bloque"]
        c["sis_nivel"] = niv[i]["nombre"]
        puntos += c["sis_puntos"]
        acum += c["total"]
        c["sis_sube"] = ""
        if i + 1 < len(niv) and acum >= niv[i + 1]["desde"]:
            i += 1
            c["sis_sube"] = niv[i]["nombre"]
        vence_desde = ultima = c["fecha"]
    vencer(hoy)
    return {"nivel": niv[i]["nombre"], "acumulado": acum, "puntos": puntos,
            "pesos": Decimal(puntos) * reglas["valor_punto"], "ultima": ultima}


def comparar(clientes: dict[int, dict], reglas: dict, prob: Problemas, hojas: tuple[str, str]) -> list[dict]:
    hoy = datetime.now(ZONA)
    filas = []
    for cli in clientes.values():
        s = simular(cli, reglas, hoy)
        cli["sistema"] = s
        dif = []
        if cli["excel_total"] is not None and cli["excel_total"] != s["acumulado"]:
            dif.append("total comprado")
        if cli["excel_nivel"] and sin_acentos(cli["excel_nivel"]) != sin_acentos(s["nivel"]):
            dif.append("nivel")
        if cli["excel_puntos"] is not None and cli["excel_puntos"] != s["puntos"]:
            dif.append("puntos")
        if cli["excel_ultima"] and (not s["ultima"] or cli["excel_ultima"] != s["ultima"].date()):
            dif.append("última compra")
        if dif:
            prob.aviso(hojas[0], cli["fila"], cli["id"],
                       "El sistema calcula distinto: " + ", ".join(dif) + " (ver hoja Comparación)")
        for c in cli["compras"]:
            if c["excel_puntos"] is not None and c["excel_puntos"] != c["sis_puntos"]:
                prob.aviso(hojas[1], c["fila"], cli["id"],
                           f"Puntos de la compra: Excel {c['excel_puntos']}, sistema {c['sis_puntos']} "
                           f"(nivel usado: {c['sis_nivel']})")
            sube_excel = sin_acentos(re.sub(r"(?i)sube a", "", c["excel_sube"])) if c["excel_sube"] else ""
            if sube_excel != sin_acentos(c["sis_sube"]):
                prob.aviso(hojas[1], c["fila"], cli["id"],
                           f"Subida de nivel: Excel «{c['excel_sube'] or 'no sube'}», "
                           f"sistema «{('Sube a ' + c['sis_sube']) if c['sis_sube'] else 'no sube'}»")
        filas.append({
            "ID": formato_id(cli["id"]),
            "Nombre": cli["nombre"],
            "Compras": len(cli["compras"]),
            "Total Excel": cli["excel_total"], "Total sistema": s["acumulado"],
            "Nivel Excel": cli["excel_nivel"], "Nivel sistema": s["nivel"],
            "Puntos Excel": cli["excel_puntos"], "Puntos sistema": s["puntos"],
            "Pesos Excel": cli["excel_pesos"], "Pesos sistema": s["pesos"],
            "Diferencias": ", ".join(dif),
        })
    return filas


# --- Supabase ----------------------------------------------------------------


def cargar_env(carpeta: Path):
    archivo = carpeta / ".env"
    if archivo.exists():
        for linea in archivo.read_text(encoding="utf-8").splitlines():
            if "=" in linea and not linea.strip().startswith("#"):
                k, v = linea.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def conectar():
    try:
        from supabase import create_client
    except ImportError:
        raise SystemExit("Falta instalar la librería: pip install -r requirements.txt")
    url = os.environ.get("SUPABASE_URL")
    llave = os.environ.get("SUPABASE_ANON_KEY")
    correo = os.environ.get("ADMIN_CORREO")
    if not url or not llave:
        raise SystemExit("Falta SUPABASE_URL o SUPABASE_ANON_KEY en importar/.env (ver .env.example).")
    correo = correo or input("Correo de la cuenta de administrador: ").strip()
    clave = os.environ.get("ADMIN_CONTRASENA") or getpass.getpass("Contraseña: ")
    sb = create_client(url, llave)
    sesion = sb.auth.sign_in_with_password({"email": correo, "password": clave})
    yo = sb.table("perfiles").select("id,nombre,rol,activa").eq("id", sesion.user.id).single().execute().data
    if yo["rol"] != "admin" or not yo["activa"]:
        raise SystemExit("La cuenta debe ser de administrador y estar activa.")
    print(f"Conectado como {yo['nombre']} (admin).")
    return sb, yo


def leer_todo(consulta_fn) -> list[dict]:
    datos, desde = [], 0
    while True:
        lote = consulta_fn().range(desde, desde + 999).execute().data
        datos += lote
        if len(lote) < 1000:
            return datos
        desde += 1000


def reglas_de_la_base(sb) -> dict:
    cfg = sb.table("configuracion").select("*").single().execute().data
    niveles = sb.table("niveles").select("*").order("desde").execute().data
    return {
        "bloque_pesos": Decimal(str(cfg["bloque_pesos"])),
        "valor_punto": Decimal(str(cfg["valor_punto"])),
        "vigencia_meses": cfg["vigencia_meses"],
        "niveles": [{"id": n["id"], "nombre": n["nombre"], "desde": Decimal(str(n["desde"])),
                     "puntos_por_bloque": n["puntos_por_bloque"]} for n in niveles],
    }


def guardar(sb, yo, clientes: dict[int, dict], compras: list[dict], prob: Problemas, hojas: tuple[str, str]):
    perfiles = sb.table("perfiles").select("id,nombre").execute().data
    por_nombre = {}
    for p in perfiles:
        n = sin_acentos(p["nombre"])
        por_nombre.setdefault(n, p["id"])
        por_nombre.setdefault(n.split(" ")[0], p["id"])

    existentes = {c["id"]: c for c in leer_todo(lambda: sb.table("clientes").select("id,telefono"))}
    tel_existentes = {c["telefono"]: c["id"] for c in existentes.values()}

    nuevos, saltados = [], set()
    for cli in clientes.values():
        if cli["id"] in existentes:
            prob.aviso(hojas[0], cli["fila"], cli["id"], "Ya estaba en el sistema; no se cambió")
            continue
        otro = tel_existentes.get(cli["telefono"])
        if otro is not None:
            prob.error(hojas[0], cli["fila"], cli["id"], f"Su teléfono ya es de TT.{otro} en el sistema")
            saltados.add(cli["id"])
            continue
        notas = cli["notas"]
        empleada = por_nombre.get(sin_acentos(cli["empleada"])) if cli["empleada"] else None
        if cli["empleada"] and not empleada:
            notas = (notas + "\n" if notas else "") + f"Registró (Excel): {cli['empleada']}"
        fila = {
            "id": cli["id"],
            "nombre": cli["nombre"],
            "telefono": cli["telefono"],
            "notas": notas,
            "registrado_por": empleada,
        }
        if cli["cumple"]:
            fila["cumple_dia"], fila["cumple_mes"] = cli["cumple"].day, cli["cumple"].month
        if cli["registro"]:
            fila["registro"] = a_las_doce(cli["registro"]).isoformat()
        nuevos.append(fila)

    for i in range(0, len(nuevos), LOTE):
        sb.table("clientes").insert(nuevos[i : i + LOTE]).execute()
        print(f"  clientes: {min(i + LOTE, len(nuevos))}/{len(nuevos)}")

    hechos = {(c["sucursal_id"], c["ticket"]) for c in
              leer_todo(lambda: sb.table("compras").select("sucursal_id,ticket").eq("cancelada", False))}
    pendientes = []
    for c in compras:
        if c["cliente_id"] in saltados:
            continue
        if (c["sucursal_id"], c["ticket"]) in hechos:
            prob.aviso(hojas[1], c["fila"], c["cliente_id"], f"El folio {c['ticket']} ya estaba en el sistema; no se repitió")
            continue
        pendientes.append({
            "cliente_id": c["cliente_id"],
            "fecha": c["fecha"].isoformat(),
            "sucursal_id": c["sucursal_id"],
            "total": str(c["total"]),
            "ticket": c["ticket"],
            "registrada_por": yo["id"],
        })
    for i in range(0, len(pendientes), LOTE):
        sb.table("compras").insert(pendientes[i : i + LOTE]).execute()
        print(f"  compras: {min(i + LOTE, len(pendientes))}/{len(pendientes)}")
    return len(nuevos), len(pendientes)


def verificar(sb, clientes: dict[int, dict]) -> list[dict]:
    """Compara lo que quedó en el sistema con lo que calculó este script."""
    ids = list(clientes)
    filas = []
    for i in range(0, len(ids), LOTE):
        datos = sb.table("resumen_clientes").select("id,nivel,puntos,acumulado").in_("id", ids[i : i + LOTE]).execute().data
        for d in datos:
            s = clientes[d["id"]].get("sistema")
            if s and (d["nivel"] != s["nivel"] or d["puntos"] != s["puntos"]):
                filas.append({"ID": formato_id(d["id"]), "Nivel base": d["nivel"], "Nivel script": s["nivel"],
                              "Puntos base": d["puntos"], "Puntos script": s["puntos"]})
    return filas


# --- Programa ----------------------------------------------------------------


def main():
    ap = argparse.ArgumentParser(description="Importa el Excel de clientes y compras a Supabase.")
    ap.add_argument("archivo", type=Path, help="El archivo .xlsx")
    ap.add_argument("--hoja-clientes", help="Nombre de la hoja de clientes (si no, se busca sola)")
    ap.add_argument("--hoja-compras", help="Nombre de la hoja de compras (si no, se busca sola)")
    ap.add_argument("--aplicar", action="store_true", help="Guardar en Supabase (sin esto solo revisa)")
    ap.add_argument("--sin-corregir-nombres", action="store_true",
                    help="No poner mayúscula inicial a los nombres (por defecto «marisol del angel» -> «Marisol del Angel»)")
    ap.add_argument("--reporte", type=Path, default=Path("reporte_importacion.xlsx"))
    args = ap.parse_args()

    cargar_env(Path(__file__).resolve().parent)
    hojas = elegir_hojas(args.archivo, args.hoja_clientes, args.hoja_compras)
    print(f"Hoja de clientes: «{hojas[0]}»   Hoja de compras: «{hojas[1]}»")

    sb = yo = None
    reglas = REGLAS_INICIALES
    sucursales = {"allende": 1, "olmos": 2, "hidalgo": 3}
    if args.aplicar:
        sb, yo = conectar()
        reglas = reglas_de_la_base(sb)
        sucursales = {sin_acentos(s["nombre"]): s["id"] for s in sb.table("sucursales").select("id,nombre").execute().data}

    prob = Problemas()
    df_cli, df_com = leer_hoja(args.archivo, hojas[0]), leer_hoja(args.archivo, hojas[1])
    col_cli = buscar_columnas([c for c in df_cli.columns if c != "_fila"], COLUMNAS_CLIENTES)
    col_com = buscar_columnas([c for c in df_com.columns if c != "_fila"], COLUMNAS_COMPRAS)
    for faltan, hoja, obligatorias in ((col_cli, hojas[0], ["id", "nombre", "telefono"]),
                                       (col_com, hojas[1], ["id", "fecha", "sucursal", "monto", "ticket"])):
        sin = [c for c in obligatorias if c not in faltan]
        if sin:
            raise SystemExit(f"En la hoja «{hoja}» no encontré las columnas: {', '.join(sin)}")
    print("Columnas de clientes: " + ", ".join(f"{k}←«{v}»" for k, v in col_cli.items()))
    print("Columnas de compras:  " + ", ".join(f"{k}←«{v}»" for k, v in col_com.items()))

    clientes = revisar_clientes(df_cli, col_cli, hojas[0], prob, not args.sin_corregir_nombres)
    compras = revisar_compras(df_com, col_com, hojas[1], prob, clientes, sucursales)
    comparacion = comparar(clientes, reglas, prob, hojas)

    errores = sum(p["Tipo"] == "NO SE IMPORTA" for p in prob.filas)
    print(f"\nListos para importar: {len(clientes)} clientes y {len(compras)} compras.")
    print(f"Filas que no se importan: {errores}.  Avisos para revisar: {len(prob.filas) - errores}.")

    verificacion = []
    if args.aplicar:
        print("\nGuardando en Supabase...")
        n_cli, n_com = guardar(sb, yo, clientes, compras, prob, hojas)
        print(f"Guardados: {n_cli} clientes nuevos y {n_com} compras.")
        verificacion = verificar(sb, clientes)
        if verificacion:
            print(f"OJO: {len(verificacion)} clientes quedaron distinto a lo calculado (hoja Verificación del reporte).")
        else:
            print("Verificado: niveles y puntos en el sistema coinciden con lo calculado.")
    else:
        print("\nSolo se revisó; no se guardó nada. Para guardar, agrega --aplicar.")

    with pd.ExcelWriter(args.reporte) as w:
        pd.DataFrame(prob.filas or [{"Tipo": "", "Problema": "Sin problemas"}]).to_excel(w, sheet_name="Problemas", index=False)
        pd.DataFrame(comparacion).to_excel(w, sheet_name="Comparación", index=False)
        if args.aplicar:
            pd.DataFrame(verificacion or [{"ID": "Todo coincide"}]).to_excel(w, sheet_name="Verificación", index=False)
    print(f"Reporte: {args.reporte.resolve()}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
