import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import BotonImagenTarjeta from '../components/ImagenTarjeta'
import { Marca } from '../components/Layout'
import { useDatos } from '../context/Datos'
import { tarjetaPublica } from '../lib/api'
import { enlaceTarjeta } from '../lib/lealtad'
import { fecha, pesos } from '../lib/formato'
import { modoDemo } from '../lib/supabase'

// Página pública que abre el cliente al escanear su QR. Solo muestra
// nombre de pila, nivel, puntos y vigencia.
export default function TarjetaCliente() {
  const { token } = useParams()
  const t = useTarjeta(token)

  if (t === undefined) return <div className="pantalla-tarjeta" />
  if (!t) {
    return (
      <div className="pantalla-tarjeta">
        <div className="tarjeta-lealtad">
          <Marca />
          <p>Esta tarjeta ya no es válida. Pide la nueva en tu sucursal.</p>
        </div>
      </div>
    )
  }

  const r = t
  return (
    <div className="pantalla-tarjeta">
      <div className="tarjeta-lealtad">
        <div className="tarjeta-arriba">
          <Marca chica />
          <span className="tarjeta-nivel">{r.nivel}</span>
        </div>
        <p className="tarjeta-hola">Hola, {t.nombre}</p>
        <div className="tarjeta-puntos">
          <span>{r.puntos.toLocaleString('es-MX')}</span>
          <small>puntos</small>
        </div>
        <p className="tarjeta-detalle tarjeta-canje">
          {r.puedeCanjear
            ? `Puedes canjearlos por ${pesos(r.pesosCanje)} en tu próxima compra.`
            : `Te faltan ${r.minimoCanje - r.puntos} puntos para tu primer canje.`}
        </p>
        <p className="tarjeta-detalle">{r.vigencia ? `Vigentes hasta el ${fecha(r.vigencia)}` : 'Sin puntos vigentes'}</p>
        {r.siguienteNivel && (
          <p className="tarjeta-detalle tarjeta-siguiente">Te faltan {pesos(r.faltaParaSiguiente)} en compras para {r.siguienteNivel}</p>
        )}
        <div className="tarjeta-qr">
          <QRCodeSVG value={enlaceTarjeta(token)} size={150} fgColor="#111111" />
          <small>Muestra este código en tienda</small>
        </div>
      </div>
      <BotonImagenTarjeta nombre={t.nombre} enlace={enlaceTarjeta(token)} className="tarjeta-guardar">
        Guardar mi tarjeta en el celular
      </BotonImagenTarjeta>
      <p className="tarjeta-pie">Joyería Torres Torres · Allende · Olmos · Hidalgo</p>
    </div>
  )
}

const useTarjeta = modoDemo ? useTarjetaDemo : useTarjetaSupabase

// En modo demo la tarjeta sale de los datos de ejemplo.
function useTarjetaDemo(token) {
  const { clientes, resumenes, reglas } = useDatos()
  const c = clientes.find((x) => x.token === token)
  return c ? { ...resumenes[c.id], nombre: c.nombre, minimoCanje: reglas.minimoCanje } : null
}

// Con Supabase se consulta la función pública: solo nombre de pila, nivel,
// puntos y vigencia. undefined mientras carga, null si el código no sirve.
function useTarjetaSupabase(token) {
  const [tarjeta, setTarjeta] = useState(undefined)
  useEffect(() => {
    tarjetaPublica(token).then(setTarjeta, () => setTarjeta(null))
  }, [token])
  return tarjeta
}
