# Informe Semanal Inmobiliario · Demo

Demo funcional para convertir el informe semanal de cada inmueble en una aplicación web:
el asesor introduce los indicadores de la semana, la aplicación guarda el histórico,
calcula variaciones y ratios, dibuja la evolución, redacta un diagnóstico comercial y
genera el PDF para el propietario con un solo botón.

**Acceso:** usuario `asesor` · contraseña `demo2026`

Los datos son de prueba. Lo que se introduce en la demo se guarda solo en el navegador
(Ajustes de usuario > Restablecer datos de prueba vuelve al estado inicial).

## Qué se puede probar

| Requisito | Dónde |
|---|---|
| Entrada rápida de visitas, favoritos, contactos, visitas presenciales, ofertas y feedback | Pestaña **Semana** |
| Guardar la semana como histórico (snapshot) | Botón **Guardar semana** |
| Variaciones, ratios de conversión y evolución | **Semana** (cálculo en vivo) y **Evolución** |
| Gráficos de líneas y diagnóstico comercial | **Evolución** |
| Empresa con su logo y colores | Desplegable de empresa (arriba a la izquierda) |
| Elegir campos, cambiar colores, subir logo o imagen | **Informe** |
| “Generar informe” en PDF idéntico a la vista previa | **Informe** > **Generar informe** |
| Varias empresas, inmuebles y campos nuevos | **Ajustes** |

## Estructura

```
index.html            Presentación de la demo
app.html              Aplicación (login + vistas)
assets/js/data.js     Campos, datos de prueba, cálculos y reglas del diagnóstico
assets/js/app.js      Interfaz: formulario, evolución, informe, PDF y ajustes
assets/css/           Estilos
assets/media/         Vídeo, fotos y recorrido
```

## Cómo añadir o quitar un campo

1. Abrir `assets/js/data.js` y localizar la lista `FIELDS`.
2. Añadir una línea con la clave y el nombre, por ejemplo:
   `{ key: 'llamadas', label: 'Llamadas recibidas', short: 'Llamadas', hint: 'Llamadas entrantes', active: true }`
   Para quitar un campo, borrar su línea o poner `active: false`.
3. Guardar. El campo aparece en el formulario, en la evolución y en el informe.

En la demo también se puede hacer sin tocar código desde **Ajustes > Campos**.

## Versión final

- Interfaz: React
- Servidor: Node.js + Express, login seguro con contraseñas cifradas y roles
- Base de datos: PostgreSQL (empresas, inmuebles, usuarios y semanas)
- Gráficos: Chart.js
- PDF: Puppeteer (Chrome), con la misma plantilla que la vista previa, clonada del modelo actual

Créditos: vídeo de Mixkit, fotos de Pexels.
