# Informe Semanal Inmobiliario · Demo

Demo funcional del informe semanal de comercialización para García-Toledano & Asociados
y AS Grupo Inmobiliario: el asesor introduce los datos y los comentarios de compradores de la semana, la
aplicación guarda el histórico, calcula ratios y acumulados desde la publicación, muestra
la fuerza comercial del inmueble con un indicador de aguja, redacta una conclusión neutra
basada en los datos y genera el informe PDF de hasta dos páginas con un solo botón.

**Acceso:** usuario `asesor` · contraseña `demo2026`

Los datos son de prueba. Lo que se introduce en la demo se guarda solo en el navegador
(menú de usuario > Restablecer datos de prueba vuelve al estado inicial).

## Qué se puede probar

| Requisito | Dónde |
|---|---|
| Visualizaciones, favoritos, solicitudes de información, no viables, visitas y ofertas | Pestaña **Semana** |
| Comentarios y feedback de compradores: fecha, nombre, valoración, motivos y comentario | **Semana** > Comentarios y feedback de compradores |
| Clientes no viables por financiación, excluidos de los ratios | **Semana**, **Evolución** e informe |
| Guardar la semana como histórico | Botón **Guardar semana** |
| Indicador de fuerza comercial y su evolución semana a semana | **Evolución** |
| Ratios, acumulado desde la publicación y motivos más repetidos | **Evolución** |
| Conclusión basada en los datos, editable | **Evolución** e **Informe** |
| Informe de hasta dos páginas, campos y bloques activables | **Informe** |
| Dos empresas con su logo, colores y tipografía | Desplegable de empresa (arriba a la izquierda) |
| "Generar informe" en PDF idéntico a la vista previa | **Informe** > **Generar informe** |
| Empresas, campos, inmuebles y usuarios | **Ajustes** |

## Estructura

```
index.html            Presentación de la demo
app.html              Aplicación (login + vistas)
assets/js/data.js     Campos, datos de prueba, cálculos, indicador de fuerza y reglas de la conclusión
assets/js/app.js      Interfaz: formulario, evolución, informe, PDF y ajustes
assets/css/           Estilos
assets/media/         Logos, vídeo, fotos y recorrido
```

## Cómo añadir o quitar un campo

1. Abrir `assets/js/data.js` y localizar la lista `FIELDS`.
2. Añadir una línea con la clave y el nombre, por ejemplo:
   `{ key: 'llamadas', label: 'Llamadas recibidas', short: 'Llamadas', hint: 'Llamadas entrantes', active: true }`
   Para quitar un campo, borrar su línea o poner `active: false`.
3. Guardar. El campo aparece en el formulario, en la evolución y en el informe.

En la demo también se puede hacer sin tocar código desde **Ajustes > Campos**.

## Indicador de fuerza comercial

Cuatro componentes de 0 a 100 (visibilidad 20 %, interés 30 %, paso a visita 30 %, ofertas 20 %)
y tres zonas: favorable 65-100, atención 40-64, revisión 0-39. Los parámetros están en `REF`
dentro de `assets/js/data.js` y se ajustan sin tocar el resto del código.

## Versión final

- Interfaz: React
- Servidor: Node.js + Express, login seguro con contraseñas cifradas, usuarios con nombre y dos accesos genéricos
- Base de datos: PostgreSQL (empresas, inmuebles, usuarios, semanas y comentarios)
- Gráficos: Chart.js
- PDF: Puppeteer (Chrome), con la misma plantilla que la vista previa

Créditos: vídeo y música de Mixkit, fotos de Pexels.
