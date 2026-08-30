#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera una pagina personalizada por prospecto a partir de las 3 plantillas base,
mas un panel de control para enviar los mensajes por WhatsApp.

    python3 demos/generar.py

Para anadir un prospecto: editalo en demos/prospectos.json y vuelve a correr esto.
"""
import json, os, re, html, urllib.parse

RAIZ = os.path.dirname(os.path.abspath(__file__))
BASE_URL = "https://jejg19-wq.github.io/brief/demos"

# ---------------------------------------------------------------- catalogos
# Contenido de MUESTRA. Se reemplaza por el real cuando el cliente cierra.

M = lambda cat, items: {"cat": cat, "items": items}

CARTAS = {
 "parrilla": {"h1":"Carne al punto,<br><em>pedida en 30 segundos.</em>",
  "sub":"Cortes a la parrilla, guarniciones y postres. Arma tu pedido o tu reserva aquí y llega ordenado a la cocina.",
  "menu":[
   M("Cortes",[{"n":"Punta trasera","p":14,"d":"250 g a la parrilla, término a elección, con dos guarniciones.","t":"El más pedido"},
               {"n":"Churrasco","p":16,"d":"Corte grueso con chimichurri de la casa."},
               {"n":"Costilla ahumada","p":15,"d":"Cocinada lenta, salsa BBQ artesanal."},
               {"n":"Pollo a la parrilla","p":10,"d":"Pechuga marinada con hierbas y limón."}]),
   M("Guarniciones",[{"n":"Papas rústicas","p":4,"d":"Con romero y sal marina."},
               {"n":"Yuca frita","p":3.5,"d":"Con salsa de ajo."},
               {"n":"Ensalada césar","p":5,"d":"Lechuga, crutones, parmesano."},
               {"n":"Tostones","p":3,"d":"Con guasacaca."}]),
   M("Bebidas",[{"n":"Cerveza nacional","p":2,"d":"Bien fría."},
               {"n":"Jugo natural","p":2,"d":"Parchita, mora o naranja."},
               {"n":"Refresco","p":1.5,"d":"Lata."},
               {"n":"Papelón con limón","p":1.5,"d":"Jarra individual."}]),
   M("Postres",[{"n":"Quesillo","p":2.5,"d":"Receta de la casa."},
               {"n":"Torta de chocolate","p":3,"d":"Con helado de vainilla."}]),
 ]},
 "sushi": {"h1":"Sushi fresco,<br><em>pedido en 30 segundos.</em>",
  "sub":"Rolls, entradas y combos. Arma tu pedido aquí y te llega ordenado, sin ir y venir por el chat.",
  "menu":[
   M("Rolls",[{"n":"California roll","p":7,"d":"Kanikama, aguacate y pepino. 8 piezas.","t":"El más pedido"},
               {"n":"Philadelphia roll","p":9,"d":"Salmón, queso crema y cebollin. 8 piezas."},
               {"n":"Tempura roll","p":9.5,"d":"Camarón tempura, aguacate y salsa de anguila."},
               {"n":"Acevichado","p":10,"d":"Cubierto de salmón y salsa acevichada."},
               {"n":"Roll vegetariano","p":6,"d":"Aguacate, pepino, zanahoria y mango."}]),
   M("Entradas",[{"n":"Gyozas (5u)","p":5,"d":"Rellenas de cerdo, salsa ponzu."},
               {"n":"Edamame","p":4,"d":"Con sal marina."},
               {"n":"Ceviche nikkei","p":8,"d":"Pescado blanco, leche de tigre y camote."}]),
   M("Combos",[{"n":"Combo 30 piezas","p":24,"d":"Tres rolls a elección. Ideal para dos.","t":"Recomendado"},
               {"n":"Combo 50 piezas","p":38,"d":"Cinco rolls a elección. Para compartir."}]),
   M("Bebidas",[{"n":"Té frío","p":2,"d":"Limón o durazno."},
               {"n":"Refresco","p":1.5,"d":"Lata."},
               {"n":"Cerveza","p":2,"d":"Bien fría."}]),
 ]},
 "hamburguesas": {"h1":"La hamburguesa de siempre,<br><em>pedida en 30 segundos.</em>",
  "sub":"Arma tu pedido completo aquí y te llega a la cocina ordenado, con el total y la dirección.",
  "menu":[
   M("Hamburguesas",[{"n":"Clasica","p":5,"d":"Carne 150 g, queso, lechuga, tomate y salsas de la casa.","t":"La más pedida"},
               {"n":"Doble carne","p":8,"d":"Dos carnes, doble queso, tocineta."},
               {"n":"Criolla","p":6.5,"d":"Carne, queso, jamon, repollo, papitas y huevo de codorniz."},
               {"n":"De pollo","p":6,"d":"Pechuga empanizada, queso y salsa de la casa."},
               {"n":"Vegetariana","p":6,"d":"Medallón de lentejas y vegetales."}]),
   M("Perros y mas",[{"n":"Perro clásico","p":3.5,"d":"Salchicha, repollo, papitas y salsas."},
               {"n":"Perro especial","p":5,"d":"Doble salchicha, tocineta y queso."},
               {"n":"Salchipapa","p":5,"d":"Papas, salchicha, queso rallado y salsas."}]),
   M("Acompañantes",[{"n":"Papas fritas","p":2.5,"d":"Porción generosa."},
               {"n":"Papas con queso","p":3.5,"d":"Con queso cheddar derretido."},
               {"n":"Tequenos (5u)","p":4,"d":"Recién hechos."}]),
   M("Bebidas",[{"n":"Refresco","p":1.5,"d":"Lata fría."},
               {"n":"Malta","p":1.5,"d":"Lata fría."},
               {"n":"Jugo natural","p":2,"d":"Del día."}]),
 ]},
 "comida-rapida": {"h1":"Tu pedido completo,<br><em>en un solo mensaje.</em>",
  "sub":"Elige lo que quieras, arma el pedido y llega ordenado a la cocina. Sin repetir la orden tres veces.",
  "menu":[
   M("Hamburguesas",[{"n":"Clasica","p":5,"d":"Carne 150 g, queso, lechuga, tomate y salsas.","t":"La más pedida"},
               {"n":"Doble","p":8,"d":"Dos carnes, doble queso y tocineta."},
               {"n":"De pollo","p":6,"d":"Pechuga empanizada con queso."}]),
   M("Perros y patacones",[{"n":"Perro clásico","p":3.5,"d":"Salchicha, repollo, papitas y salsas."},
               {"n":"Patacón de carne","p":6,"d":"Carne mechada, queso y salsas."},
               {"n":"Patacón mixto","p":7,"d":"Carne, pollo y queso."}]),
   M("Para picar",[{"n":"Papas fritas","p":2.5,"d":"Porción generosa."},
               {"n":"Salchipapa","p":5,"d":"Papas, salchicha y queso."},
               {"n":"Tequenos (5u)","p":4,"d":"Recién hechos."},
               {"n":"Alitas (6u)","p":6,"d":"BBQ o picantes."}]),
   M("Bebidas",[{"n":"Refresco","p":1.5,"d":"Lata fría."},
               {"n":"Malta","p":1.5,"d":"Lata fría."},
               {"n":"Jugo natural","p":2,"d":"Del día."}]),
 ]},
 "pizza": {"h1":"Tu pizza,<br><em>pedida en 30 segundos.</em>",
  "sub":"Elige tamaño y sabor, arma el pedido y llega ordenado al horno. Con el total ya calculado.",
  "menu":[
   M("Pizzas",[{"n":"Margarita","p":8,"d":"Salsa de la casa, mozzarella y albahaca.","t":"La más pedida"},
               {"n":"Pepperoni","p":10,"d":"Doble pepperoni y mozzarella."},
               {"n":"Cuatro quesos","p":12,"d":"Mozzarella, parmesano, azul y de mano."},
               {"n":"Hawaiana","p":10,"d":"Jamón, piña y mozzarella."},
               {"n":"Mexicana","p":12,"d":"Carne, jalapeños, pimentón y cebolla."},
               {"n":"Vegetariana","p":10,"d":"Champiñones, pimentón, cebolla y aceitunas."}]),
   M("Para acompañar",[{"n":"Pan de ajo","p":3,"d":"Con queso gratinado."},
               {"n":"Alitas (6u)","p":6,"d":"BBQ o picantes."},
               {"n":"Ensalada césar","p":5,"d":"Con crutones y parmesano."}]),
   M("Bebidas",[{"n":"Refresco 2L","p":3,"d":"Para compartir."},
               {"n":"Refresco lata","p":1.5,"d":"Bien frío."},
               {"n":"Cerveza","p":2,"d":"Nacional."}]),
 ]},
 "cafe": {"h1":"Tu café de siempre,<br><em>pedido sin cola.</em>",
  "sub":"Arma tu pedido aquí, pasa y retira. O te lo llevamos. Todo en un solo mensaje.",
  "menu":[
   M("Cafe",[{"n":"Espresso","p":1,"d":"Café de altura tachirense."},
               {"n":"Café con leche","p":1.5,"d":"Grande, con espuma."},
               {"n":"Capuchino","p":2,"d":"Con canela o cacao.","t":"El más pedido"},
               {"n":"Latte","p":2,"d":"Suave, con arte en la espuma."},
               {"n":"Frappé de café","p":3,"d":"Frio, con crema batida."}]),
   M("Para acompañar",[{"n":"Croissant","p":2,"d":"De mantequilla, recién horneado."},
               {"n":"Tequenos (3u)","p":2.5,"d":"Recién hechos."},
               {"n":"Sándwich de pollo","p":4,"d":"Pan artesanal, pollo y vegetales."},
               {"n":"Tostada francesa","p":4,"d":"Con miel y frutas."}]),
   M("Dulces",[{"n":"Porción de torta","p":2.5,"d":"Pregunta por la del día."},
               {"n":"Brownie","p":2,"d":"Con nueces."},
               {"n":"Galletas (3u)","p":1.5,"d":"De avena o chispas de chocolate."}]),
 ]},
 "postres": {"h1":"Tu encargo,<br><em>anotado sin errores.</em>",
  "sub":"Elige lo que necesitas, pon la fecha de entrega y manda el encargo completo en un solo mensaje.",
  "menu":[
   M("Tortas",[{"n":"Torta de chocolate","p":18,"d":"Bizcocho húmedo con ganache. 20 porciones.","t":"La más pedida"},
               {"n":"Torta tres leches","p":20,"d":"Clásica, con merengue."},
               {"n":"Torta de zanahoria","p":18,"d":"Con frosting de queso crema."},
               {"n":"Torta personalizada","p":25,"d":"Diseño a tu gusto. Encargar con 3 días."}]),
   M("Postres individuales",[{"n":"Quesillo","p":2.5,"d":"Porción generosa."},
               {"n":"Marquesa de chocolate","p":3,"d":"Vasito individual."},
               {"n":"Tiramisú","p":3.5,"d":"Receta de la casa."},
               {"n":"Cheesecake de fresa","p":3.5,"d":"Con salsa natural."}]),
   M("Para eventos",[{"n":"Docena de cupcakes","p":12,"d":"Decorados a tu gusto."},
               {"n":"Mesa dulce (30 pzs)","p":35,"d":"Surtido de mini postres."},
               {"n":"Bandeja de brownies","p":15,"d":"24 porciones."}]),
 ]},
 "ferreteria": {"h1":"Consulta el precio<br><em>sin preguntar por chat.</em>",
  "sub":"Busca lo que necesitas, mira si hay existencia y manda la cotización armada en un solo mensaje.",
  "menu":[
   M("Electricidad",[{"n":"Cable THW #12 (metro)","p":0.9,"d":"Cobre, 100% garantizado.","t":"Alta rotación"},
               {"n":"Breaker 2x30A","p":8,"d":"Marca comercial, enchufable."},
               {"n":"Tomacorriente doble","p":2.5,"d":"Con placa incluida."},
               {"n":"Bombillo LED 12W","p":2,"d":"Luz blanca o calida."}]),
   M("Plomeria",[{"n":"Tubo PVC 1/2 (6m)","p":6,"d":"Presion, uso sanitario."},
               {"n":"Llave de paso 1/2","p":4.5,"d":"Bronce."},
               {"n":"Sifón lavamanos","p":5,"d":"PVC con rejilla."},
               {"n":"Pega PVC 1/4","p":3.5,"d":"Secado rápido."}]),
   M("Herramientas",[{"n":"Taladro percutor 1/2","p":45,"d":"650W, con maletín.","t":"Recomendado"},
               {"n":"Juego de destornilladores","p":12,"d":"6 piezas, punta imán."},
               {"n":"Cinta métrica 5m","p":5,"d":"Con freno y clip."},
               {"n":"Martillo uña de chivo","p":8,"d":"Mango de fibra."}]),
   M("Pinturas",[{"n":"Caucho blanco (galon)","p":14,"d":"Interior y exterior."},
               {"n":"Esmalte sintético (1/4)","p":6,"d":"Varios colores."},
               {"n":"Brocha 3 pulgadas","p":3,"d":"Cerda natural."}]),
 ]},
 "insumos": {"h1":"Tu pedido al mayor,<br><em>armado sin errores.</em>",
  "sub":"Arma tu pedido con cantidades y precios, y mándalo completo en un solo mensaje. Sin listas por foto.",
  "menu":[
   M("Coloracion",[{"n":"Tinte profesional","p":6,"d":"Todos los tonos. Precio al detal.","t":"Alta rotación"},
               {"n":"Agua oxigenada (1L)","p":4,"d":"10, 20, 30 y 40 volúmenes."},
               {"n":"Decolorante (500g)","p":9,"d":"Polvo azul, sin amoníaco."},
               {"n":"Matizador","p":7,"d":"Neutraliza tonos amarillos."}]),
   M("Tratamientos",[{"n":"Keratina (1L)","p":22,"d":"Alisado profesional."},
               {"n":"Ampolla capilar","p":2,"d":"Unidad. Descuento por caja."},
               {"n":"Shampoo profesional (1L)","p":10,"d":"Sin sal."},
               {"n":"Mascarilla reparadora","p":11,"d":"Envase de 1 kg."}]),
   M("Herramientas",[{"n":"Máquina de corte","p":38,"d":"Profesional, con accesorios."},
               {"n":"Secador 2000W","p":30,"d":"Dos velocidades."},
               {"n":"Plancha de titanio","p":35,"d":"Temperatura regulable."},
               {"n":"Tijera de corte","p":18,"d":"Acero inoxidable."}]),
   M("Insumos",[{"n":"Capa de corte","p":6,"d":"Impermeable."},
               {"n":"Guantes (caja 100u)","p":8,"d":"Latex, talla M o L."},
               {"n":"Papel aluminio para mechas","p":5,"d":"Rollo profesional."}]),
 ]},
}

SERV = {
 "barberia": {"h1":"Corte<span class=\"out\">sin</span>espera",
  "sub":"Reserva tu silla en 20 segundos. Sin llamar, sin esperar que contesten el chat, sin hacer cola en el local.",
  "kicker":"San Cristóbal · Táchira",
  "ticker":["Fades","Barba a navaja","Toalla caliente","Sin espera","Diseños","Reserva online"],
  "equipoTit":"El equipo","equipoSub":"Elige con quién quieres cortarte, o déjanos asignarte al primero disponible.",
  "paso2":"¿Con quién?",
  "servicios":[
   {"n":"Corte clásico","p":5,"min":30,"d":"Corte a máquina y tijera, perfilado y toalla caliente."},
   {"n":"Corte + barba","p":8,"min":45,"d":"El combo completo. Corte, barba a navaja y ritual de toalla."},
   {"n":"Barba a navaja","p":4,"min":25,"d":"Perfilado con navaja, aceites y bálsamo."},
   {"n":"Corte infantil","p":4,"min":25,"d":"Para los peques, con paciencia y sin dramas."},
   {"n":"Diseño / freestyle","p":7,"min":40,"d":"Líneas, degradados y diseños a mano alzada."},
   {"n":"Tinte / camuflaje","p":10,"min":50,"d":"Cubrir canas o cambiar de color, con productos profesionales."}],
  "equipo":[{"n":"Barbero 1","esp":"Fades y diseños","ini":"1"},{"n":"Barbero 2","esp":"Clásico y barba","ini":"2"},
            {"n":"Barbero 3","esp":"Tintes y color","ini":"3"},{"n":"Cualquiera","esp":"El primero libre","ini":"*"}]},

 "salon": {"h1":"Tu cita<span class=\"out\">sin</span>llamadas",
  "sub":"Reserva en 20 segundos. Eliges el servicio, el día y la hora — y nosotros te esperamos lista.",
  "kicker":"San Cristóbal · Táchira",
  "ticker":["Alisados","Color","Uñas","Cejas","Sin espera","Reserva online"],
  "equipoTit":"El equipo","equipoSub":"Elige con quién quieres atenderte, o déjanos asignarte a la primera disponible.",
  "paso2":"¿Con quién?",
  "servicios":[
   {"n":"Corte y secado","p":8,"min":45,"d":"Corte a tijera, lavado y secado con cepillo."},
   {"n":"Tinte completo","p":25,"min":90,"d":"Color de raíz a puntas con productos profesionales."},
   {"n":"Mechas / balayage","p":40,"min":120,"d":"Iluminación con matizado incluido."},
   {"n":"Alisado / keratina","p":45,"min":120,"d":"Tratamiento con keratina, dura varios meses."},
   {"n":"Manicure y pedicure","p":10,"min":60,"d":"Limpieza, esmaltado y masaje."},
   {"n":"Diseño de cejas","p":5,"min":25,"d":"Depilación, perfilado y tinte."},
   {"n":"Maquillaje social","p":15,"min":45,"d":"Para eventos, con pestañas incluidas."}],
  "equipo":[{"n":"Estilista 1","esp":"Color y mechas","ini":"1"},{"n":"Estilista 2","esp":"Corte y peinado","ini":"2"},
            {"n":"Estilista 3","esp":"Uñas y cejas","ini":"3"},{"n":"Cualquiera","esp":"La primera libre","ini":"*"}]},

 "spa": {"h1":"Tu cita<span class=\"out\">sin</span>llamadas",
  "sub":"Reserva tu tratamiento en 20 segundos. Eliges servicio, día y hora — y llegas a que te atiendan.",
  "kicker":"San Cristóbal · Táchira",
  "ticker":["Faciales","Uñas","Cejas","Masajes","Sin espera","Reserva online"],
  "equipoTit":"El equipo","equipoSub":"Elige con quién quieres atenderte, o déjanos asignarte a la primera disponible.",
  "paso2":"¿Con quién?",
  "servicios":[
   {"n":"Limpieza facial profunda","p":20,"min":60,"d":"Extracción, exfoliación y mascarilla."},
   {"n":"Diseño de cejas","p":5,"min":25,"d":"Depilación, perfilado y tinte."},
   {"n":"Pestañas pelo a pelo","p":25,"min":90,"d":"Extensiones con acabado natural."},
   {"n":"Manicure semipermanente","p":12,"min":60,"d":"Esmaltado que dura tres semanas."},
   {"n":"Masaje relajante","p":18,"min":60,"d":"Cuerpo completo con aceites tibios."},
   {"n":"Tratamiento reductor","p":22,"min":60,"d":"Sesión con aparatología."}],
  "equipo":[{"n":"Especialista 1","esp":"Faciales y masajes","ini":"1"},{"n":"Especialista 2","esp":"Uñas y pestañas","ini":"2"},
            {"n":"Cualquiera","esp":"La primera libre","ini":"*"}]},

 "gym": {"h1":"Tu clase<span class=\"out\">sin</span>cola",
  "sub":"Reserva tu cupo o tu evaluación en 20 segundos. Sin llamar y sin esperar que contesten el chat.",
  "kicker":"San Cristóbal · Táchira",
  "ticker":["Musculación","Funcional","Spinning","Evaluación gratis","Cupos limitados","Reserva online"],
  "equipoTit":"Los entrenadores","equipoSub":"Elige con quién quieres entrenar, o déjanos asignarte al primero disponible.",
  "paso2":"¿Con quién?",
  "servicios":[
   {"n":"Evaluación inicial","p":0,"min":40,"d":"Medidas, objetivos y plan de arranque. Sin costo."},
   {"n":"Pase por día","p":3,"min":90,"d":"Acceso completo a la sala de máquinas."},
   {"n":"Clase funcional","p":4,"min":60,"d":"Grupo reducido, cupo limitado."},
   {"n":"Clase de spinning","p":4,"min":50,"d":"Reserva tu bici con anticipacion."},
   {"n":"Entrenamiento personalizado","p":12,"min":60,"d":"Uno a uno con entrenador."},
   {"n":"Plan mensual","p":25,"min":30,"d":"Acceso ilimitado. Cita para inscribirte."}],
  "equipo":[{"n":"Entrenador 1","esp":"Fuerza e hipertrofia","ini":"1"},{"n":"Entrenador 2","esp":"Funcional y cardio","ini":"2"},
            {"n":"Entrenador 3","esp":"Nutrición deportiva","ini":"3"},{"n":"Cualquiera","esp":"El primero libre","ini":"*"}]},
}

TRAT = {
 "odontologia": {"h1":"Tu cita al día,<br><span class=\"serif\">sin llamar a nadie.</span>",
  "sub":"Odontología general y estética en San Cristóbal. Elige tu tratamiento, tu día y tu hora — y recibe la confirmación al instante por WhatsApp.",
  "esp":"Odontología general y estética",
  "tratamientos":[
   {"n":"Consulta de valoracion","p":0,"min":20,"ic":"🔍","c":"a1","d":"Revisión completa, diagnostico y plan de tratamiento. Sin costo."},
   {"n":"Limpieza dental","p":20,"min":40,"ic":"✨","c":"a2","d":"Profilaxis con ultrasonido, pulido y aplicación de flúor."},
   {"n":"Resina / calza","p":25,"min":45,"ic":"🦷","c":"a1","d":"Restauración estética del color de tu diente."},
   {"n":"Extracción simple","p":20,"min":30,"ic":"⚕️","c":"a3","d":"Con anestesia local e indicaciones post-operatorias."},
   {"n":"Blanqueamiento","p":90,"min":60,"ic":"💎","c":"a2","d":"Blanqueamiento en consultorio, resultado en una sesión."},
   {"n":"Endodoncia","p":80,"min":75,"ic":"🔧","c":"a1","d":"Tratamiento de conducto por unidad, con radiografía incluida."},
   {"n":"Ortodoncia (inicio)","p":150,"min":60,"ic":"📐","c":"a3","d":"Colocación de brackets. Mensualidad aparte."},
   {"n":"Prótesis / corona","p":120,"min":60,"ic":"👑","c":"a2","d":"Corona en porcelana. Requiere dos sesiones."}],
  "equipo":[{"n":"Consulta general","esp":""},{"n":"Estética dental","esp":""},{"n":"Ortodoncia","esp":""},{"n":"El primero disponible","esp":""}]},

 "dermatologia": {"h1":"Tu consulta al día,<br><span class=\"serif\">sin llamar a nadie.</span>",
  "sub":"Dermatología clínica y estética en San Cristóbal. Elige el motivo de consulta, tu día y tu hora — y recibe la confirmación por WhatsApp.",
  "esp":"Dermatología clínica y estética",
  "tratamientos":[
   {"n":"Consulta dermatológica","p":25,"min":30,"ic":"🔍","c":"a1","d":"Evaluación completa de piel, diagnóstico y tratamiento."},
   {"n":"Revisión de lunares","p":30,"min":30,"ic":"🔬","c":"a2","d":"Dermatoscopia y control de lesiones pigmentadas."},
   {"n":"Tratamiento de acné","p":35,"min":40,"ic":"✨","c":"a1","d":"Plan personalizado con seguimiento mensual."},
   {"n":"Peeling químico","p":45,"min":45,"ic":"💧","c":"a2","d":"Renovación de la piel, manchas y textura."},
   {"n":"Crioterapia","p":30,"min":20,"ic":"❄️","c":"a3","d":"Eliminación de verrugas y queratosis."},
   {"n":"Biopsia de piel","p":60,"min":40,"ic":"⚕️","c":"a3","d":"Toma de muestra con estudio anatomopatológico."},
   {"n":"Consulta capilar","p":30,"min":30,"ic":"💇","c":"a1","d":"Evaluación de caída de cabello y cuero cabelludo."},
   {"n":"Control post-tratamiento","p":0,"min":15,"ic":"📋","c":"a2","d":"Seguimiento incluido tras el procedimiento."}],
  "equipo":[{"n":"Consulta clínica","esp":""},{"n":"Consulta estética","esp":""},{"n":"El primero disponible","esp":""}]},
}

# --------------------------------------------------------------- utilidades
def js(obj):
    return json.dumps(obj, ensure_ascii=False, indent=None)

def sub_array(src, nombre, valor):
    pat = re.compile(r"var " + nombre + r" = \[[\s\S]*?\n  \];")
    nuevo = "var " + nombre + " = " + js(valor) + ";"
    out, n = pat.subn(lambda m: nuevo, src, count=1)
    if n != 1:
        raise SystemExit("No se pudo reemplazar el arreglo " + nombre)
    return out

def set_wa(src, wa):
    """Pone el WhatsApp de Jackson sea cual sea el que traiga la plantilla."""
    out, n = re.subn(r"whatsapp: '\d+',", "whatsapp: '" + wa + "',", src, count=1)
    if n != 1:
        raise SystemExit("No se encontro el campo whatsapp en la plantilla")
    return out

def rep(src, viejo, nuevo, obligatorio=True):
    if viejo not in src:
        if obligatorio:
            raise SystemExit("No se encontro el texto:\n  " + viejo[:110])
        return src
    return src.replace(viejo, nuevo)

def barra(p):
    return ('<strong>PROPUESTA</strong> · Ejemplo hecho para ' + html.escape(p["nombre"])
            + '. Productos y precios de muestra. <a href="' + BASE_URL + '/">¿Quién hizo esto?</a>')

def logo_split(nombre):
    partes = nombre.split(" ", 1)
    return (html.escape(partes[0]), html.escape(partes[1]) if len(partes) > 1 else "")

# ------------------------------------------------------------- restaurante
def gen_restaurante(base, p, wa):
    c = CARTAS[p["carta"]]
    n = html.escape(p["nombre"]); zona = html.escape(p["zona"])
    a, b = logo_split(p["nombre"])
    s = base
    s = rep(s, "<title>Sabor Andino · Restaurante — Demo</title>", "<title>" + n + " — Propuesta de página web</title>")
    s = rep(s, 'content="Menú digital con pedido directo por WhatsApp. Plantilla demo para restaurantes de San Cristóbal."',
               'content="Propuesta de página con pedidos por WhatsApp para ' + n + '."')
    s = rep(s, '<span><strong>DEMO</strong> · Plantilla de ejemplo. Los datos no son de un negocio real.</span>\n  <a href="../index.html">Quiero una así →</a>',
               barra(p), obligatorio=False)
    s = rep(s, '<strong>DEMO</strong> · Plantilla de ejemplo, negocio ficticio. <a href="../index.html">Quiero una así →</a>',
               barra(p), obligatorio=False)
    s = rep(s, '<div class="logo">Sabor<span>Andino</span></div>',
               '<div class="logo">' + a + (('<span>' + b + '</span>') if b else '') + '</div>')
    s = rep(s, '<p class="kicker">Comida andina · San Cristóbal</p>',
               '<p class="kicker">' + html.escape(p["tipo"]) + ' · San Cristóbal</p>')
    s = rep(s, 'La cocina de la abuela,<br><em>pedida en 30 segundos.</em>', c["h1"])
    s = rep(s, 'Pabellón, cachapas y hervido andino hechos como en casa. Arma tu pedido aquí y te llega ordenado a la cocina — sin ir y venir por el chat.', c["sub"])
    s = rep(s, '<p>Carrera 6 con calle 10, Barrio Obrero.<br>San Cristóbal, Táchira.</p>',
               '<p>' + zona + '.<br>San Cristóbal, Táchira.</p>')
    s = rep(s, '<p>Sabor Andino · San Cristóbal, Táchira — <em>negocio de ejemplo</em></p>',
               '<p>' + n + ' · San Cristóbal, Táchira — <em>propuesta de ejemplo</em></p>')
    s = rep(s, '<p style="margin-top:8px">Plantilla creada por <a href="../index.html">Jackson · Webs y pedidos por WhatsApp</a></p>',
               '<p style="margin-top:8px">Propuesta hecha por <a href="' + BASE_URL + '/">Jackson · Webs y pedidos por WhatsApp</a></p>')
    s = rep(s, "negocio: 'Sabor Andino',", "negocio: '" + p["nombre"].replace("'", "\\'") + "',")
    s = set_wa(s, wa)
    if p["carta"] in ("ferreteria", "insumos"):
        s = rep(s, '<h2>Nuestro menú</h2>', '<h2>Nuestro catálogo</h2>')
        s = rep(s, 'Toca «Agregar» en lo que quieras. Al final te armamos el pedido completo y lo mandas por WhatsApp con un toque.',
                   'Toca «Agregar» en lo que necesites. Al final te armamos la cotización completa y la mandas por WhatsApp con un toque.')
        s = rep(s, '<h2 style="margin:0 auto 12px">¿Con hambre ya?</h2>', '<h2 style="margin:0 auto 12px">¿Listo para pedir?</h2>')
        s = rep(s, 'Arma tu pedido y te lo tenemos listo. Sin llamadas, sin repetir la orden tres veces.',
                   'Arma tu pedido y te lo tenemos listo. Sin llamadas, sin preguntar precio uno por uno.')
        s = rep(s, 'Empezar mi pedido', 'Armar mi pedido')
        s = rep(s, 'Nota para la cocina (opcional)', 'Nota para el pedido (opcional)')
        s = rep(s, 'Ej: sin cebolla, bien caliente', 'Ej: lo necesito para hoy mismo')
        s = rep(s, '<b>25 min</b>Delivery promedio', '<b>Mismo día</b>Entregas en la ciudad')
        s = rep(s, '<b>7 días</b>Abiertos toda la semana', '<b>Lun a Sáb</b>Horario de atención')
    s = sub_array(s, "MENU", c["menu"])
    return s

# ---------------------------------------------------------------- barberia
def gen_barberia(base, p, wa):
    c = SERV[p["carta"]]
    n = html.escape(p["nombre"]); zona = html.escape(p["zona"])
    a, b = logo_split(p["nombre"])
    s = base
    s = rep(s, "<title>Navaja Barbershop · Reservas — Demo</title>", "<title>" + n + " — Propuesta de página web</title>")
    s = rep(s, 'content="Reserva tu cita en segundos. Plantilla demo para barberías de San Cristóbal."',
               'content="Propuesta de página con reservas por WhatsApp para ' + n + '."')
    s = rep(s, '<strong>DEMO</strong> · Plantilla de ejemplo, negocio ficticio. <a href="../index.html">Quiero una así →</a>', barra(p))
    s = rep(s, '<div class="logo">Navaja<em>/</em>Barbershop</div>',
               '<div class="logo">' + a + (('<em>/</em>' + b) if b else '') + '</div>')
    s = rep(s, 'San Cristóbal · Táchira · Desde 2016', html.escape(p["tipo"]) + ' · San Cristóbal')
    s = rep(s, 'Corte<span class="out">sin</span>espera', c["h1"])
    s = rep(s, 'Reserva tu silla en 20 segundos. Sin llamar, sin esperar que contesten el chat, sin hacer cola en el local.', c["sub"])
    s = rep(s, '<h2>El equipo</h2><p>Elige con quién quieres cortarte, o déjanos asignarte al primero disponible.</p>',
               '<h2>' + c["equipoTit"] + '</h2><p>' + c["equipoSub"] + '</p>')
    s = rep(s, '<h3>¿Con quién?</h3>', '<h3>' + c["paso2"] + '</h3>')
    s = rep(s, 'Reserva directo con \'+b.n+\' desde el formulario de abajo.', 'Reserva directo con \'+b.n+\' desde el formulario de abajo.', obligatorio=False)
    s = rep(s, '<p>Av. Carabobo con calle 8, Barrio Obrero.<br>San Cristóbal, Táchira.</p>',
               '<p>' + zona + '.<br>San Cristóbal, Táchira.</p>')
    s = rep(s, '<p>Navaja Barbershop · San Cristóbal — <em>negocio de ejemplo</em></p>',
               '<p>' + n + ' · San Cristóbal, Táchira — <em>propuesta de ejemplo</em></p>')
    s = rep(s, '<p style="margin-top:6px">Plantilla creada por <a href="../index.html">Jackson · Webs y citas por WhatsApp</a></p>',
               '<p style="margin-top:6px">Propuesta hecha por <a href="' + BASE_URL + '/">Jackson · Webs y citas por WhatsApp</a></p>')
    s = rep(s, "negocio: 'Navaja Barbershop',", "negocio: '" + p["nombre"].replace("'", "\\'") + "',")
    s = set_wa(s, wa)
    if p["carta"] == "gym":
        s = rep(s, '<b>4</b><span class="mono">Barberos</span>', '<b>3</b><span class="mono">Entrenadores</span>')
        s = rep(s, '<b>20s</b><span class="mono">En reservar</span>', '<b>20s</b><span class="mono">En reservar</span>')
        s = rep(s, 'Reservar mi cita', 'Reservar mi cupo')
    s = sub_array(s, "SERVICIOS", c["servicios"])
    s = sub_array(s, "BARBEROS", c["equipo"])
    s = rep(s, "var words = ['Fades','Barba a navaja','Toalla caliente','Sin espera','Diseños','Barrio Obrero','Reserva online'];",
               "var words = " + js(c["ticker"]) + ";")
    return s

# ----------------------------------------------------------------- clinica
def gen_clinica(base, p, wa):
    c = TRAT[p["carta"]]
    n = html.escape(p["nombre"]); zona = html.escape(p["zona"])
    s = base
    s = rep(s, "<title>Clínica Dental Sonrisa · Citas — Demo</title>", "<title>" + n + " — Propuesta de página web</title>")
    s = rep(s, 'content="Agenda tu consulta odontológica en línea. Plantilla demo para clínicas y consultorios de San Cristóbal."',
               'content="Propuesta de página con agenda en línea para ' + n + '."')
    s = rep(s, '<strong>DEMO</strong> · Plantilla de ejemplo, clínica ficticia. <a href="../index.html">Quiero una así →</a>', barra(p))
    s = rep(s, '<div class="logo"><i>✚</i> Clínica Sonrisa</div>', '<div class="logo"><i>✚</i> ' + n + '</div>')
    s = rep(s, 'Tu cita al día,<br><span class="serif">sin llamar a nadie.</span>', c["h1"])
    s = rep(s, 'Odontología general y estética en San Cristóbal. Elige tu tratamiento, tu día y tu hora — y recibe la confirmación al instante por WhatsApp.', c["sub"])
    s = rep(s, '<p>Calle 14 con carrera 3, Edificio Los Andes, piso 2, consultorio 21. San Cristóbal, Táchira.</p>',
               '<p>' + zona + '. San Cristóbal, Táchira.</p>')
    s = rep(s, '<p>Clínica Dental Sonrisa · San Cristóbal, Táchira — <em>clínica de ejemplo</em></p>',
               '<p>' + n + ' · San Cristóbal, Táchira — <em>propuesta de ejemplo</em></p>')
    s = rep(s, '<p style="margin-top:8px">Plantilla creada por <a href="../index.html">Jackson · Webs y citas por WhatsApp</a></p>',
               '<p style="margin-top:8px">Propuesta hecha por <a href="' + BASE_URL + '/">Jackson · Webs y citas por WhatsApp</a></p>')
    s = rep(s, "negocio: 'Clínica Dental Sonrisa',", "negocio: '" + p["nombre"].replace("'", "\\'") + "',")
    s = set_wa(s, wa)
    if p["carta"] == "dermatologia":
        s = rep(s, '<h2>Tratamientos y precios</h2>', '<h2>Consultas y procedimientos</h2>')
        s = rep(s, 'Los tratamientos complejos se cotizan en la consulta de valoración, que es gratuita.',
                   'Los procedimientos mayores se cotizan en la consulta inicial.')
    s = sub_array(s, "TRATAMIENTOS", c["tratamientos"])
    s = sub_array(s, "DOCTORES", c["equipo"])
    return s

GEN = {"restaurante": gen_restaurante, "barberia": gen_barberia, "clinica": gen_clinica}

# ---------------------------------------------------------------- mensajes
def mensaje(p, link):
    n = p["nombre"]; g = p["gancho"]
    base, carta = p["base"], p["carta"]
    if base == "clinica":
        return ("Buenas tardes. Soy Jackson, hago páginas web aquí en San Cristóbal.\n\n"
                "Le escribo por algo puntual: " + g + ".\n\n"
                "Antes de escribirle le monté una agenda de ejemplo con el nombre de " + n + " para que la vea funcionando:\n" + link + "\n\n"
                "Ábrala en el teléfono y pida una cita de prueba. El paciente elige tratamiento, día y hora, y a usted le llega todo ordenado en un solo mensaje.\n\n"
                "Si le parece útil le muestro cómo quedaría con sus tratamientos y sus horarios reales. Y si no es para usted, no le vuelvo a escribir.")
    if base == "barberia":
        if carta == "gym":
            return ("Buenas, ¿hablo con el encargado de " + n + "?\n\n"
                    "Soy Jackson, hago páginas web aquí en San Cristóbal. " + g[0].upper() + g[1:] + ".\n\n"
                    "Le monté una página de ejemplo con el nombre de " + n + ":\n" + link + "\n\n"
                    "Ábrala en el teléfono y reserve un cupo de prueba. El cliente elige el plan o la clase, el día y la hora — y a usted le llega todo en un solo mensaje.\n\n"
                    "¿Le cuento cómo funciona en 5 minutos?")
        return ("Buenas, ¿hablo con el dueño de " + n + "?\n\n"
                "Soy Jackson, hago páginas web aquí en San Cristóbal. Una pregunta rápida: ¿cuántas citas se les caen a la semana porque el cliente no avisó que no venía?\n\n"
                "Le monté una agenda de ejemplo con el nombre de " + n + " para que la vea:\n" + link + "\n\n"
                "El cliente elige servicio, día y hora sin llamar, y usted llena la agenda sin soltar la máquina. " + g[0].upper() + g[1:] + ".\n\n"
                "Si le interesa le explico en 5 minutos.")
    # restaurante y catalogos
    if carta == "postres":
        return ("Buenas, ¿hablo con el dueño de " + n + "?\n\n"
                "Soy Jackson, hago páginas de pedidos aquí en San Cristóbal. Le escribo por algo puntual: " + g + ".\n\n"
                "Le armé un ejemplo con el nombre de " + n + " para que lo vea funcionando:\n" + link + "\n\n"
                "Ábralo en el teléfono y haga un encargo de prueba. Va a ver que le llega todo en un solo mensaje, con las cantidades y el total ya calculado.\n\n"
                "¿Le cuento cómo funciona?")
    if carta in ("ferreteria", "insumos"):
        return ("Buenas, ¿hablo con el encargado de " + n + "?\n\n"
                "Soy Jackson, hago catálogos en línea aquí en San Cristóbal. Le escribo por algo puntual: " + g + ".\n\n"
                "Le armé un catálogo de ejemplo con el nombre de " + n + ":\n" + link + "\n\n"
                "Ábralo en el teléfono y arme un pedido de prueba. El cliente ve el precio y si hay existencia, y le manda la cotización armada en un solo mensaje — usted deja de contestar «¿cuánto vale?» todo el día.\n\n"
                "¿Le cuento cómo funciona?")
    return ("Buenas, ¿hablo con el dueño de " + n + "?\n\n"
            "Soy Jackson, hago páginas de pedidos aquí en San Cristóbal. Le escribo por algo puntual: " + g + ".\n\n"
            "Le armé un ejemplo con el nombre de " + n + " para que lo vea funcionando:\n" + link + "\n\n"
            "Ábralo en el teléfono y arme un pedido de prueba. Va a ver que sale todo en un solo mensaje, con el total y la dirección — sin preguntar tres veces.\n\n"
            "¿Le cuento cómo funciona?")

def seguimiento(p, link):
    return ("Buenas, le escribí hace unos días por lo de la página de pedidos para " + p["nombre"] + ".\n\n"
            "Si no le interesa no hay problema, no le escribo más. Solo quería asegurarme de que le llegó el ejemplo:\n" + link)

# ---------------------------------------------------------------- tandas
# Orden de ataque. La tanda 1 no es la de mas seguidores: es la de dueños
# accesibles por movil, con catalogo corto, que se entregan en un dia.
TANDA1 = ["maria-silva","barberia-gustavo-sc","oral-center","sonrivida","dra-karla-rosales",
          "gimnasio-gold","paraiso-de-las-tortas"]
# Cuentas grandes o poco activas: van cuando ya haya casos que mostrar.
TANDA3 = ["dulce-y-dulce","la-casa-del-peluquero","plastic-tortas","ferreteria-raca",
          "helus-resto-bar","wakame-sushi-bar","burger-express","faena-steak-house",
          "toche","bosque-restaurante","la-reina-burger","pizzas-tachira",
          "pizzeria-vincenzo","gympoc","jeiky-barbers-room","capos-barberia",
          "dra-rossana-sanchez"]

def tanda(slug):
    if slug in TANDA1: return 1
    if slug in TANDA3: return 3
    return 2

# -------------------------------------------------------------------- main
def main():
    import brief_tpl
    globals()["brief_tpl"] = brief_tpl
    datos = json.load(open(os.path.join(RAIZ, "prospectos.json"), encoding="utf-8"))
    wa_jackson = datos["jackson"]["whatsapp"]
    bases = {k: open(os.path.join(RAIZ, k, "index.html"), encoding="utf-8").read()
             for k in ("restaurante", "barberia", "clinica")}

    salida = []
    for p in datos["prospectos"]:
        if p.get("custom"):
            # Paginas hechas a mano para ese cliente: no se generan ni se pisan.
            link = BASE_URL + p["ruta"]
            brief = BASE_URL + p.get("brief_url", p["ruta"])
            salida.append(dict(p, link=link, brief=brief, tanda=tanda(p["slug"]),
                               msg=p["msg_custom"].replace("{LINK}", link),
                               msg2=seguimiento(p, link)))
            continue
        pagina = GEN[p["base"]](bases[p["base"]], p, wa_jackson)
        d = os.path.join(RAIZ, "p", p["slug"])
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(pagina)
        link = BASE_URL + "/p/" + p["slug"] + "/"

        sp = brief_tpl.SPEC[p["carta"]]
        db = os.path.join(RAIZ, "brief", p["slug"])
        os.makedirs(db, exist_ok=True)
        open(os.path.join(db, "index.html"), "w", encoding="utf-8").write(
            brief_tpl.render(p, sp, link, BASE_URL))
        brief = BASE_URL + "/brief/" + p["slug"] + "/"

        salida.append(dict(p, link=link, brief=brief, tanda=tanda(p["slug"]),
                           msg=mensaje(p, link), msg2=seguimiento(p, link)))

    panel(salida, wa_jackson)
    print("Generadas " + str(len(salida)) + " paginas + el panel.")

def panel(ps, wa_jackson):
    import panel_tpl
    open(os.path.join(RAIZ, "panel", "index.html"), "w", encoding="utf-8").write(
        panel_tpl.render(ps, wa_jackson, BASE_URL))

if __name__ == "__main__":
    import sys
    sys.path.insert(0, RAIZ)
    main()
