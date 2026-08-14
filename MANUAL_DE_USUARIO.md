# Manual de Usuario - Control de Programación FTL & Simulador
### Oman Air OM-A Capítulo 7 (Reglamentación válida a Agosto 2026)

---

## 1. Introducción y Marco Reglamentario

Esta aplicación es una **Herramienta Progresiva Multiplataforma (PWA)** diseñada para pilotos y tripulaciones de vuelo de Oman Air. Su objetivo principal es auditar, verificar y simular la legalidad de programaciones mensuales (*Rosters*), bitácoras históricas (*Logbooks*) y cambios de última hora (*What-If Simulator*), asegurando el cumplimiento estricto de las limitaciones de tiempo de vuelo y descanso estipuladas en el **Manual de Operaciones Parte A (OM-A), Capítulo 7**.

> **Nota Reglamentaria:**  
> La reglamentación programada en el motor de cálculo corresponde a la versión oficial válida a **Agosto de 2026**, con Base de Operaciones principal en **Mascate (MCT - UTC+4)**.

---

## 2. Límites Operativos Clave (OM-A 7.1.4 y 7.1.5)

| Parámetro | Límite Máximo Reglamentario | Referencia OM-A |
| :--- | :--- | :--- |
| **Tiempo de Vuelo en 28 días** | **100 Horas** (Alerta preventiva a las 90h) | OM-A 7.1.4(1) |
| **Tiempo de Vuelo en 12 meses** | **900 Horas** | OM-A 7.1.4(2) |
| **Tiempo de Servicio en 7 días** | **55 Horas** (Alerta preventiva a las 50h) | OM-A 7.1.4(3) |
| **Tiempo de Servicio en 14 días** | **95 Horas** | OM-A 7.1.4(4) |
| **Tiempo de Servicio en 28 días** | **190 Horas** | OM-A 7.1.4(5) |
| **Días Consecutivos de Servicio** | **Máximo 7 Días** antes de requerir Días Libres Reglamentarios | OM-A 7.1.5(1) |
| **Descanso Mínimo Previo** | $\ge \max(\text{Duración del Servicio Anterior}, 12\text{h})$ | OM-A 7.1.6.4 |
| **Día Libre Reglamentario (*Day Off*)** | $\ge 34\text{ Horas}$ continuas e incluyendo **2 noches locales** en base | OM-A 7.1.5 |

---

## 3. Importación Inteligente de eCrew (Roster & Logbook)

La aplicación admite dos formatos oficiales exportados por el sistema **eCrew / AIMS**:

### A. Roster Mensual (*Personal Crew Schedule Report CSV*)
* **Días Libres Oficiales (`OFF` y `COFF`):** Reconocidos automáticamente en color verde (`🏖️ Day Off`). Reinician el contador de días consecutivos trabajados a 0.
* **Guardias en Casa (`SBY`):** Se computan con el **$25\%$ de crédito de servicio** hacia los límites acumulativos de 7d, 14d y 28d (**OM-A 7.1.7.8.c**).
* **Conversión de Hora de Estación a UTC:** Los reportes de eCrew exportados en *(All times in Local Station)* son convertidos automáticamente a UTC según los husos horarios IATA de cada destino (`ZRH`, `BLR`, `RUH`, `TAS`, `TZX`, `DXB`, etc.).
* **Fusión Inteligente sin Duplicados:** Puedes importar un mes tantas veces como sea necesario; el sistema actualiza los vuelos existentes sin duplicar registros.

### B. Bitácora Histórica de Vuelos (*Flight Logbook CSV*)
* Importa el historial acumulado de vuelos reales para alimentar los gráficos móviles de 28 días y 12 meses.

---

## 4. Guardias y Activaciones (*Standby & Callouts - OM-A 7.1.7*)

### 1. Home Standby (`SBY`)
* **Crédito Acumulativo:** El $25\%$ del tiempo de guardia suma a tus horas de servicio en 7d, 14d y 28d.
* **Activación (*Callout*):**
  * Si te llaman dentro de las primeras **6 horas** de guardia: El FDP máximo permitido no se reduce y el FDP comienza a contar desde la hora de presentación en el aeropuerto (**OM-A 7.1.7.8.f**).
  * Si te llaman después de **6 horas**: El FDP máximo permitido de la Tabla A se reduce minuto a minuto por el tiempo de guardia que exceda las 6 horas (**OM-A 7.1.7.8.g**).

### 2. Airport Standby
* Cuenta al **$100\%$ como tiempo de servicio**.
* Si se asigna un vuelo tras más de 4 horas en el aeropuerto, el FDP máximo se reduce por el exceso sobre 4 horas (**OM-A 7.1.7.4.a**).

---

## 5. Tabla A (FDP Máximo Diario Acclimatised - OM-A 7.1.6.9)

El FDP comienza en la hora de presentación (*Report Time*) y **finaliza en Calzos Puestos (*Chocks-On*) del último vuelo**.

| Hora Local de Presentación | 1 Sector | 2 Sectores | 3 Sectores | 4 Sectores |
| :---: | :---: | :---: | :---: | :---: |
| **06:00 – 07:59** | 13h 00m | 12h 15m | 11h 30m | 10h 45m |
| **08:00 – 12:59** | 14h 00m | 13h 15m | 12h 30m | 11h 45m |
| **13:00 – 17:59** | 13h 00m | 12h 15m | 11h 30m | 10h 45m |
| **18:00 – 21:59** | 12h 00m | 11h 15m | 10h 30m | 09h 45m |
| **22:00 – 05:59** | 11h 00m | 10h 15m | 09h 30m | 09h 00m |

*Nota:* Los 30 minutos de post-vuelo (*Debrief / Checkout*) marcan el momento en que **inicia el descanso previo** hacia el siguiente vuelo.

---

## 6. Funcionalidades del Logbook y Dashboard

* **Línea Divisoria `📍 TODAY`:** Separa visualmente los vuelos completados del pasado de las asignaciones futuras programadas en tu roster.
* **Tarjeta Emergente Flotante (*Hover Card* en PC):** Al pasar el ratón por cualquier fila, se despliega una ventana flotante con el margen de FDP, descanso previo y el contador de días consecutivos (`Day X/7`).
* **Modal Inspector (PC y Móvil):** Haz clic o toca cualquier fila para abrir el desglose completo del periodo de servicio, tramos, matrículas y cumplimiento legal.
* **Filtros de Línea de Tiempo:** Botones para filtrar rápidamente: *All Timeline*, *🟣 Upcoming Roster*, *🔵 Completed*, *🔴 Violations*, *🟡 Tight Margin*.

---

## 7. Simulador "What-If" (Planificador de Cambios)

Permite simular cambios de programación antes de aceptarlos:
1. Agrega los tramos propuestos (ej. `MCT-DXB-MCT`).
2. Configura los horarios de salida y llegada.
3. El simulador calculará automáticamente:
   * Horas de presentación reglamentarias.
   * FDP calculado vs FDP Máximo permitido por la Tabla A.
   * Descanso mínimo reglamentario requerido tras el servicio.
   * Impacto en tus ventanas acumuladas de 28 días y 7 días de servicio.

---

## 8. Privacidad, Uso Offline y Reseteo

* **100% Local y Privado:** Toda tu información de vuelos se almacena exclusivamente en tu dispositivo (`LocalStorage`). No se envía ningún dato personal a servidores externos ni a GitHub.
* **Acceso Offline Total:** Gracias al *Service Worker*, la app y este manual funcionan sin conexión a internet en modo avión o en escala.
* **Botón `🔄 Reset & Update`:** Borra los datos locales, purga la caché del navegador y recarga la versión más reciente en vivo desde GitHub Pages.

---

## 9. Descargo de Responsabilidad Aeronáutica

> **AVISO LEGAL / USE AT YOUR OWN RISK:**  
> Esta aplicación es una herramienta de apoyo al análisis y toma de decisiones para tripulaciones de vuelo. No reemplaza el sistema oficial de la aerolínea (eCrew/AIMS), las directrices de Control de Operaciones (OCC) ni la responsabilidad legal y operacional del Comandante y la Tripulación de Vuelo bajo las Regulaciones de Aviación Civil de Omán (CAR-OPS) y el Manual OM-A.
