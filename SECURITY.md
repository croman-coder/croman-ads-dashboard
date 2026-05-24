# Informe de Seguridad — Croman Ads Dashboard

## Resumen

Esta aplicación gestiona campañas pagas en Meta Ads. Maneja credenciales sensibles
(token de Meta, sesiones de usuario) y puede modificar inversión real. La auditoría
siguiente cubre los puntos críticos identificados y las correcciones aplicadas.

---

## Problemas encontrados y por qué eran un riesgo

### 1. Sin autenticación — exposición total
**Riesgo:** Cualquiera con la URL podía ver datos de cuentas, cambiar presupuestos,
pausar campañas y crear nuevas. Equivale a entregar las llaves de Meta Ads Manager
a internet entero.

### 2. Sin tope de presupuesto
**Riesgo:** Un error humano (o un atacante con sesión) podía subir el presupuesto
diario a cualquier monto. Si alguien escribía `100000` en vez de `100`, Meta cobraba
USD 100.000 antes de que nadie pudiera reaccionar.

### 3. Token de Meta accesible al navegador
**Riesgo:** Si el token viajaba al front-end, cualquier herramienta del navegador podía
copiarlo. Con ese token, otra persona controlaría todas las cuentas Meta del Business
Manager.

### 4. Sin protección contra fuerza bruta
**Riesgo:** Un atacante podía probar miles de contraseñas por minuto contra el login
hasta acertar. Con `admin123` como password inicial, esto se descubre en segundos.

### 5. Sin headers de seguridad del navegador
**Riesgo:** El navegador no tenía instrucciones de bloquear iframes maliciosos,
ejecutar scripts de orígenes desconocidos, o adivinar tipos de archivo. Esto abre
puerta a clickjacking, XSS y MIME-sniffing.

### 6. Sin validación de inputs
**Riesgo:** Si el cliente enviaba `object_id = "{$ne: null}"` o similar, el backend
podía pasarlo a Meta API tal cual. Puerta a inyección y errores impredecibles.

### 7. Variables de entorno mal protegidas
**Riesgo:** `.env.local` con contraseñas estaba en el repositorio si no se ignoraba
en `.gitignore`. Cualquier persona con acceso al repo veía las credenciales.

---

## Cambios aplicados

### Autenticación
- Login con email + contraseña en `/login`.
- Contraseña verificada con **bcrypt** (no se guarda en plano).
- Sesión emitida como **JWT firmado** y guardado en **cookie HttpOnly**:
  - `HttpOnly`: el navegador no permite a JavaScript leerla → inmune a XSS común.
  - `SameSite=Lax`: bloquea envíos cross-site (anti CSRF básico).
  - `Secure` en producción: solo viaja por HTTPS.
- Duración: 7 días con renovación al iniciar sesión.

### Middleware (puerta de entrada)
- Toda ruta no pública requiere sesión válida.
- Sin sesión → redirect a `/login?next=<destino>` (preserva intención).
- APIs sin sesión devuelven `401 No autenticado` (no 500 ni datos parciales).

### Rate limiting en login
- Máximo **5 intentos por IP cada 15 minutos**.
- Excedido devuelve `429 Too Many Requests` con header `Retry-After`.
- Protege contra fuerza bruta automatizada.

### Tope de presupuesto
- Límite configurable vía `BUDGET_CAP_USD` (default **1000 USD**).
- Aplicado en **dos lugares**:
  - Cliente: input HTML con `max={cap}`, color rojo si excede.
  - Servidor: rechaza con `422 Unprocessable Entity` y mensaje claro.
- Defensa en profundidad: nunca confiar solo en cliente.

### Headers de seguridad (vía `next.config.ts`)
| Header | Qué hace |
|---|---|
| `X-Frame-Options: DENY` | Impide embeberse en iframes → anti clickjacking. |
| `X-Content-Type-Options: nosniff` | Bloquea MIME sniffing → previene ejecución de tipos mal interpretados. |
| `Strict-Transport-Security` | Fuerza HTTPS por 2 años. |
| `Referrer-Policy` | Limita info enviada en referrer headers. |
| `Permissions-Policy` | Desactiva cámara, mic, geo, browsing-topics. |
| `Content-Security-Policy` | Restringe orígenes permitidos para scripts/styles/fetch. |
| `X-Powered-By` removido | Ocultamos versión Next.js. |

### Validación de inputs
- API budget: valida `object_id` (solo dígitos), `amount` (número finito > 0), `type` (whitelist).
- API login: rechaza body inválido, email/password no string o >200 chars.
- API rename/status: ya validaban presencia y formato.

### Token Meta — solo backend
- `META_ACCESS_TOKEN` vive en variable de entorno del servidor.
- **Nunca** se envía al cliente. Las llamadas a Meta pasan por API routes de Next.
- Front-end consume `/api/*` que internamente usa el token.

### Logging seguro
- Errores devueltos al cliente no exponen stacks ni paths internos.
- API errors usan `error.message` formateado, no objetos completos.

### .gitignore
- `.env`, `.env.local`, `.env*.local` ignorados en el repo.
- `.env.example` versionado sin credenciales reales.

---

## Recomendaciones para mantener seguridad

### Inmediato (antes de producción)
1. **Cambiar `AUTH_SECRET`** por valor aleatorio de 64+ caracteres:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
2. **Cambiar contraseña `admin123`** por algo fuerte. Regenerar hash:
   ```bash
   node -e "const b=require('bcryptjs');const h=b.hashSync('NUEVA_PASSWORD_FUERTE',12);console.log(Buffer.from(h).toString('base64'))"
   ```
   Y subir `AUTH_PASSWORD_HASH_B64` a Vercel.
3. **Configurar todos los env vars en Vercel** — nunca commitear secretos.

### Próximas 4 semanas
4. **Rotar token Meta cada 60 días** — Meta los vence automáticamente.
5. **Activar 2FA en cuenta Google/Meta/Vercel** del admin.
6. **Auditar accesos** — quién más usa el Business Manager.
7. **Backup regular del Bitrix CRM** — los datos de leads viven ahí.

### Largo plazo
8. **Migrar a OAuth Meta Business** para auth (cada usuario con su token).
9. **Multi-usuario con roles** (admin / viewer / editor).
10. **Migrar rate limit a Upstash/Redis** si el deploy escala a multi-instance.
11. **Log de auditoría** — qué cambió quién y cuándo, persistido a base de datos.
12. **Webhook handler** para eventos críticos de Meta (rejected ads, billing failures).

### Operativas
- **No compartir credenciales por chat/email** — usar gestor de contraseñas.
- **Revisar logs de Vercel** cada 2 semanas para anomalías.
- **Revocar tokens viejos** desde Meta Business Manager si dejan de usarse.
- **Revisar SECURITY.md cada release** y actualizar este informe.

---

## Variables de entorno requeridas (Vercel)

| Variable | Sensible | Propósito |
|---|---|---|
| `META_ACCESS_TOKEN` | 🔴 | Token Meta Marketing API |
| `META_API_VERSION` | — | Versión API (default `v21.0`) |
| `AUTH_EMAIL` | 🟡 | Email del admin autorizado |
| `AUTH_PASSWORD_HASH_B64` | 🔴 | bcrypt hash en base64 |
| `AUTH_SECRET` | 🔴 | Secret para firmar JWT (≥32 chars) |
| `BUDGET_CAP_USD` | — | Tope presupuesto (default 1000) |

Solo el admin del proyecto Vercel debe tener acceso a estas variables.

---

## Contacto incidente de seguridad

Si detectás compromiso (acceso no autorizado, cambios extraños en campañas, tokens
filtrados):

1. **Rotar inmediato:** `AUTH_SECRET` → invalida todas las sesiones existentes.
2. **Revocar token Meta** desde Business Manager → corta acceso del atacante.
3. **Cambiar contraseña admin.**
4. **Auditar Meta Ads Manager** para cambios no autorizados.
5. **Restaurar campañas** desde la última config conocida.

---

**Versión informe:** 1.0
**Fecha:** mayo 2026
**Autor:** Croman Ads · Santa Rosa Paraguay

---

## Approval workflow (Phase 6)

All risky mutations require explicit approval before reaching Meta:

- `set_budget`, `activate`, `create_campaign`, `duplicate_campaign`
- Pending proposals stored in Postgres, expire in 72h
- Vercel cron (`/api/proposals/expire`) clears stale entries every 6h
- `SELECT FOR UPDATE` lock prevents double-approve race
- All status transitions audit-logged (proposed_by, decided_by, decided_at)
- Payload re-validated at execute time (cap, IDs, fields)
- Snapshot of current state captured at propose time

Required env vars:
- `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` (auto by Vercel Postgres)
- `CRON_SECRET` — random 32+ chars, bearer-auth for cron endpoint
