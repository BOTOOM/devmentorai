# Plan: agentes ACP "de un clic" y UI presentable (Fase 10)

Estado: **aprobado**. La Fase 10A está implementada (emparejamiento + token de WebSocket + error
accionable); las fases 10B–10E siguen pendientes.

Objetivo: que la experiencia de agentes sea la de Devin Desktop — una lista precargada de
todos los agentes con un botón *Enable*, un agente por defecto, y la autenticación resuelta
sin instalar nada cuando el agente lo permite (token/env) — y que la UI esté a la altura del
resto de la extensión en claro y oscuro.

---

## 1. Diagnóstico (causa raíz verificada en el código)

### 1.1 El modal aparece vacío y el backend registra `403 WebSocket origin is not allowed`

El gateway solo acepta el origin del WebSocket si coincide con `ACP_EXTENSION_ORIGIN`,
con `ACP_ALLOWED_ORIGINS` o con el origin del fixture de E2E
(`apps/backend/src/acp/gateway.ts:153-156`; se configuran en `apps/backend/src/server.ts:107-109`).

El `chrome-extension://<id>` de una extensión cargada en local no lo conoce nadie de antemano,
así que **por defecto todas las conexiones se rechazan**. Consecuencias observadas en tus capturas:

- `GET /acp → 403` repetido en el log del backend.
- El modal se abre pero `ui/agents.list` / `ui/profiles.list` nunca responden, así que la lista
  de agentes sale vacía y solo quedan los controles.
- El chat ACP tampoco puede promptear.

Nota adicional: REST está abierto a cualquier origin (`cors { origin: true }` en
`apps/backend/src/server.ts:122-126`) mientras el WebSocket es estricto. Esa asimetría no aporta
seguridad real hoy — cualquier página puede llamar al REST — y sí rompe el producto. Hay que
unificar el modelo, no solo relajar el WS.

### 1.2 La UI de agentes es un prototipo funcional, no una UI diseñada

- `AcpCatalogView` usa `className="w-full rounded border px-2 py-1"` sin colores ni variante
  oscura, y los botones no tienen estilo (`apps/extension/src/components/AcpCatalogView.tsx`).
- `AcpProfileEditor` son seis `<input>` desnudos, sin etiquetas visibles, sin agrupar y sin
  estilo — es exactamente lo que se ve en tu captura.
- El resto de la extensión sí usa el sistema de diseño (`primary-*`, `gray-*`, `dark:`,
  patrón de modal de `NewSessionModal`), así que la desviación está localizada en estos dos
  componentes y en el modal que los envuelve (`SidePanel.tsx:423-452`).

### 1.3 No existe el concepto "Enable"

Hoy el flujo es: *Install* → escribir un perfil a mano → seleccionar el perfil → usar. El
usuario tiene que saber comando, argumentos, transporte y cwd. Devin Desktop, en cambio, tiene
estado por agente (*Enable* / *Enabled*), un agente por defecto (la estrella) y resuelve la
autenticación por agente.

Lo que **sí** tenemos ya y se puede reutilizar sin reescribir nada:

- Catálogo con los 38 agentes del registry oficial + built-ins, con `icon`, `name`,
  `description`, `version` y `distribution` (el registry expone icono y web por agente).
- Instalación por `npx`/`uvx` (lazy, sin descargar nada hasta el primer uso), binarios y comando.
- Almacén de credenciales cifrado en el backend y resolución de referencias
  `credential://nombre` dentro del `env` del perfil (`credentials.ts`, `launch-resolver.ts`).
- `authMethods` reales que cada agente anuncia en `initialize`, y `authenticate` por método.

Es decir: **falta la capa de producto (estado enabled + metadatos de auth + UI), no la fontanería.**

---

## 2. Propuesta

### Fase 10A — Conectar sin configurar (bloqueante)

1. Emparejamiento por confianza en el primer uso (TOFU): el backend acepta el primer origin
   `chrome-extension://` que se conecta, lo persiste en `~/.devmentorai/` y a partir de ahí solo
   acepta ese; `ACP_EXTENSION_ORIGIN` / `ACP_ALLOWED_ORIGINS` siguen funcionando como override
   explícito, y habrá un comando para resetear el emparejamiento.
2. Además, el WebSocket exige un token de sesión emitido por el REST local, de modo que la
   protección real no dependa del origin (y se elimina la asimetría con CORS).
3. Cuando el gateway rechaza una conexión, la extensión lo muestra como error accionable
   ("el backend rechazó esta extensión: ejecuta …") en vez de un modal vacío.

Criterios de aceptación:
- Con el backend recién arrancado y la extensión cargada sin variables de entorno, el modal
  lista los agentes y el chat ACP funciona.
- Un segundo origin distinto sigue siendo rechazado mientras no se resetee el emparejamiento.
- Test de integración de los tres casos: primer emparejamiento, segundo origin rechazado, override por env.

### Fase 10B — "Enable" como modelo de datos

1. Estado por agente persistido en el backend: `enabled`, `default`, más el perfil implícito que
   se crea al habilitar (nombre = nombre del agente, `agentId` = entrada del catálogo, `args`
   vacíos, cwd = workspace por defecto). El editor de perfiles pasa a ser *avanzado*, no el camino
   principal.
2. `Enable` es idempotente y no descarga nada para agentes `npx`/`uvx` (siguen en `lazy`); la
   primera sesión es la que instala.
3. Un agente por defecto (la estrella): las sesiones nuevas y las quick actions lo usan sin
   preguntar.
4. Deshabilitar cierra las conexiones vivas de ese agente y conserva credenciales y sesiones.

Criterios de aceptación:
- Habilitar un agente y abrir una sesión no requiere tocar ningún campo de texto.
- El agente por defecto sobrevive a reinicios del backend.
- Deshabilitar no borra el historial ni las credenciales.

### Fase 10C — Autenticación preconfigurada, pero como datos

Sigue la regla del proyecto: **nada de adapters por proveedor**. Se añade un *overlay* de
metadatos declarativo (JSON en el repo, versionado, fusionado sobre la entrada del registry) con,
por agente: variables de entorno de credencial admitidas, si acepta login local, enlace a la
página donde se genera el token y el permiso necesario. Todo lo que no esté en el overlay cae al
camino genérico.

Camino genérico (sirve para los 38 agentes, incluidos los que aparezcan mañana):
1. Al habilitar, el backend conecta y lee los `authMethods` que el agente anuncia.
2. Si `session/new` responde `auth_required`, la UI ofrece los métodos del propio agente
   (incluido el login local del agente cuando existe) y un formulario de token/env genérico.
3. El token se guarda cifrado en el backend y se inyecta como `env` en el lanzamiento vía
   `credential://`. Nunca se guarda en el almacenamiento de la extensión.

Caso concreto que pediste (Copilot sin instalar nada en local): la documentación de GitHub
confirma que Copilot CLI toma el token de `COPILOT_GITHUB_TOKEN`, `GH_TOKEN` o `GITHUB_TOKEN`
por ese orden, y que para un PAT fine-grained hace falta el permiso *Copilot Requests*. Con eso,
"pegar el token" es suficiente: sin `copilot login` ni keychain. Esas variables entran en el
overlay junto con el enlace de creación del token y el permiso requerido.

Criterios de aceptación:
- Habilitar Copilot CLI, pegar un PAT y abrir una sesión funciona sin `copilot login`.
- Un agente sin entrada en el overlay sigue siendo utilizable: se muestran sus `authMethods`
  y un editor de variables de entorno.
- El token no aparece en logs, ni en el `storage` de la extensión, ni en el volcado de perfiles.

### Fase 10D — Rediseño de la UI de agentes

1. Sección **Agents** en la página de opciones (el sitio análogo al de tu captura de Devin
   Desktop): buscador, filas con icono real del registry, nombre, descripción, estado
   (`Enabled` / `Enable` / `Auth required` / `Unavailable en esta plataforma`), estrella para el
   agente por defecto y un menú `⋯` para lo avanzado (perfil personalizado, TCP, env, sonda de
   conformidad, desinstalar).
2. En el side panel, un selector compacto del agente activo con acceso a la sección completa;
   deja de ser el sitio donde se editan perfiles.
3. Tema: se usan los tokens del resto de la extensión y se verifica claro y oscuro; los inputs
   pasan a tener etiqueta, foco visible y estados de error.
4. `Enable` con estado de carga real, errores en línea y reintento (nunca un botón que queda
   deshabilitado para siempre).

Criterios de aceptación:
- Captura de la sección en claro y en oscuro sin contrastes rotos.
- Toda la funcionalidad avanzada actual sigue accesible desde el menú `⋯`.
- Tests de la vista: habilitar, deshabilitar, marcar por defecto, agente que requiere auth,
  agente no disponible en la plataforma, y fallo de habilitación con reintento.

### Fase 10E — Verificación y documentación

- Unit + integración de backend y extensión, E2E del camino "habilitar → sesión → prompt" con el
  agente fixture, y regeneración de `docs/ACP.md` solo con mediciones reales.
- `README` y `docs/ACP.md`: cómo habilitar un agente, qué agentes aceptan token por env y qué
  agentes exigen login local.

---

## 3. Lo que NO propongo

- No cambio el modelo ACP ni la arquitectura host/cliente: esto es capa de producto.
- No añado código específico por proveedor; el overlay es data-only y el camino genérico manda.
- No relajo la seguridad para arreglar el 403: el emparejamiento sustituye una validación que
  hoy no protege nada (REST está abierto) por una que sí.
- No integro Antigravity mientras no haya ACP nativo o una ruta permitida por sus términos.

## 4. Decisiones que necesito de ti

1. ¿Dónde quieres la sección de agentes: página de opciones (como Devin Desktop) o un panel
   dentro del side panel? Mi recomendación: opciones para la gestión completa y un selector
   compacto en el side panel.
2. ¿Un PR nuevo apilado sobre #68 (Fase 10), o lo reparto en dos (conexión/UX y auth)?
   Mi recomendación: dos PRs — 10A solo, porque desbloquea tus pruebas hoy mismo, y el resto detrás.
3. ¿Qué agentes usas en local? Con esa lista priorizo el overlay de auth y las pruebas reales.

## 5. Riesgos

- El emparejamiento TOFU es una decisión de seguridad: protege contra otras extensiones/páginas,
  no contra otro usuario de la misma cuenta local. Queda documentado en ADR-0007.
- Los metadatos de auth por agente envejecen; van versionados en el repo y el camino genérico
  garantiza que un dato obsoleto no rompa a ningún agente.
- El registry puede publicar agentes cuya autenticación exige un navegador; ahí la única ruta
  honesta es el login local del propio agente, y la UI debe decirlo en vez de fingir soporte.
