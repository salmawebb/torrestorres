import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import BotonImagenTarjeta from '../components/ImagenTarjeta'
import { Marca } from '../components/Layout'
import { tarjetaPublica } from '../lib/api'
import { enlaceTarjeta } from '../lib/lealtad'
import { fecha, pesos } from '../lib/formato'

// Página pública que abre el cliente al escanear su QR. Solo muestra
// nombre de pila, número de cliente, nivel, puntos y vigencia.
export default function TarjetaCliente() {
  const { token } = useParams()
  const t = useTarjeta(token)

  if (t === undefined) return <div className="pantalla-tarjeta" />
  if (!t) {
    return (
      <div className="pantalla-tarjeta">
        <div className="tarjeta-lealtad">
          <Marca mini />
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
          <Marca mini />
          <span className="tarjeta-nivel">{r.nivel}</span>
        </div>
        {r.numero != null && <p className="tarjeta-numero">Cliente n.º {r.numero}</p>}
        <p className="tarjeta-hola">Hola, {t.nombre}</p>
        <div className="tarjeta-puntos">
          <span>{r.puntos.toLocaleString('es-MX')}</span>
          <small>puntos</small>
        </div>
        <p className="tarjeta-detalle tarjeta-canje">
          {r.puedeCanjear
            ? `Puedes canjearlos por ${pesos(r.pesosCanje)} en tu próxima compra.`
            : r.minimoCanje <= 1
              ? 'Acumula puntos con tus compras para canjearlos.'
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
      <BotonImagenTarjeta nombre={t.nombre} numero={t.numero} enlace={enlaceTarjeta(token)} className="tarjeta-guardar">
        Guardar mi tarjeta en el celular
      </BotonImagenTarjeta>
      <p className="tarjeta-pie">Joyería Torres Torres · Allende · Olmos · Hidalgo</p>
    </div>
  )
}

// Con Supabase se consulta la función pública: solo nombre de pila, nivel,
// puntos y vigencia. undefined mientras carga, null si el código no sirve.
function useTarjeta(token) {
  const [tarjeta, setTarjeta] = useState(undefined)
  useEffect(() => {
    tarjetaPublica(token).then(setTarjeta, () => setTarjeta(null))
  }, [token])
  return tarjeta
}
