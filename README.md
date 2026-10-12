# Menú Abierto | Catálogos digitales multirrestaurante

**Menú Abierto** es el nombre de trabajo de la plataforma. No es un nombre legal ni se ha comprobado su disponibilidad de marca/dominio. El frontend usa HTML, CSS y JavaScript nativos; no requiere `npm install`, paquetes ni compilación. Los restaurantes, platos, precios, horarios e imágenes de ejemplo están marcados como demostración y no representan negocios reales.

## Probar en local

Se requiere una instalación existente de Node.js únicamente para el servidor local. Desde esta carpeta ejecuta:

```powershell
node server.js
```

Abre `http://127.0.0.1:4173/` para el directorio, `/negocios/` para conocer el servicio, `/r/mesa-limon/` o `/r/patio-bruma/` para los catálogos y `/admin/` para administración. `server.js` usa solo módulos incluidos en Node; sirve el `index.html` de carpetas existentes y usa el SPA fallback para el resto.

## Rutas y hosting estático

La aplicación reconoce `/`, `/negocios/`, `/admin/` y `/r/{slug}/` leyendo `window.location.pathname`. La página comercial se prerenderiza durante la publicación. Para que una ruta de la app funcione al abrirla o recargarla directamente, el hosting debe devolver `index.html` para rutas sin archivo correspondiente. `_redirects` en la raíz incluye el fallback de Netlify; GitHub Pages usa `404.html` para conservar rutas profundas. En otros hosts configura la regla equivalente según su documentación.

### GitHub Pages

Se añadió `.github/workflows/pages.yml`: al hacer push a `main`, GitHub Actions publica el sitio estático sin instalar dependencias ni ejecutar una compilación. `.nojekyll` evita transformaciones del árbol por Jekyll. `404.html` conserva rutas profundas como `/NOMBRE-DEL-REPOSITORIO/r/mesa-limon/`; `index.html` restaura esa ruta y mantiene el prefijo de proyecto en assets y enlaces. En GitHub, selecciona **Settings → Pages → Build and deployment → GitHub Actions**. Los enlaces profundos deben verificarse una vez que el repositorio esté publicado.

GitHub Pages sirve el contenido como sitio público. No publiques datos privados allí. La clave `sb_publishable` puede aparecer en el frontend únicamente con RLS correcta; la URL y la clave pública están configuradas, pero Auth no podrá operar correctamente hasta aplicar la migración y crear una membresía autorizada. Pages se usa para esta demo pública, no se declara como proveedor comercial verificado.

La portada lista restaurantes con catálogo activo consultados con clave pública y RLS. Mientras la tabla no exista o no se pueda consultar, aparecen únicamente las dos fichas de demostración con esa etiqueta. Ejemplos publicados: [Mesa Limón](https://osorioosiel990-design.github.io/Menus/r/mesa-limon/) y [Patio Bruma](https://osorioosiel990-design.github.io/Menus/r/patio-bruma/). El panel está en [Administración](https://osorioosiel990-design.github.io/Menus/admin/).

El repositorio público es `osorioosiel990-design/Menus`. `.github/workflows/pages.yml` publica al hacer push a `main` y reconstruye el sitemap cada día. GitHub Pages está configurado con **GitHub Actions**. El flujo usa solo Node incluido en el runner, sin instalar paquetes.

### Cloudflare Pages

Para publicar la misma web en Cloudflare, conecta el repositorio desde **Workers & Pages → Create application → Pages → Connect to Git** y elige la rama `main`. Usa preset **None**, raíz `/`, comando de compilación `node scripts/generate-sitemap.js` y carpeta de salida `.`. No hace falta instalar paquetes. El comando genera el HTML SEO de `/negocios/`, las páginas de restaurantes y el sitemap antes de cada publicación. `_redirects` mantiene el fallback de las rutas de la app.

El `404.html` conserva rutas profundas; el workflow genera `negocios/index.html` y, para los restaurantes activos, `r/{slug}/index.html` con contenido SEO estático. El sitemap incluye la página para negocios y los catálogos publicados.

### SEO y Google

- Portada, página comercial y restaurantes tienen títulos, descripciones, URL canonical, Open Graph/Twitter e información estructurada JSON-LD.
- La página `/negocios/` publica el Plan Básico: 1.500 CUP mensual; 3.915 CUP por trimestre (13% de descuento); 7.650 CUP por seis meses (15%); y 14.400 CUP por año (20%). Enlaza a WhatsApp, pero no procesa pagos.
- El panel de administración genera un QR vectorial SVG del catálogo público para descargar o imprimir. La librería QR se carga de forma diferida desde jsDelivr con versión e integridad fijadas.
- CSS y JavaScript se solicitan con una versión basada en el commit de despliegue para reducir la posibilidad de que Google procese un bundle antiguo y obtenga metadatos inconsistentes.
- `/admin/` se sirve con `noindex,nofollow,noarchive`; el panel privado no debe aparecer en Google.
- El workflow genera la página comercial, páginas de restaurantes activos y `sitemap.xml`; la tarea diaria vuelve a consultar los slugs publicados.
- SEO no garantiza una posición concreta ni indexación inmediata. Google puede tardar días en volver a rastrear.

El nombre **Menú Abierto** es una propuesta de marca para la plataforma, no para cada restaurante. Su disponibilidad legal y de dominio no está verificada. Los restaurantes conservan sus propios nombres y slugs.

Slugs demo disponibles: `mesa-limon`, `patio-bruma` y `demo-inactivo`. Los otros slugs muestran un estado de catálogo inexistente. El buscador y los filtros se ejecutan en el navegador sobre los datos demo actuales.

## Base de datos Supabase (fase 3)

La migración versionada está en `supabase/migrations/20261011000100_initial_catalog_schema.sql`. Incluye restaurantes, miembros, categorías, productos, claves foráneas compuestas que impiden asignar productos a categorías de otro restaurante, índices, restricciones, RLS y el bucket `restaurant-catalog`.

El acceso global se añade mediante `supabase/migrations/20261011000200_platform_super_admin.sql`. No cambia el significado de `owner`, `admin` o `editor`: crea un registro de plataforma separado y RLS sigue determinando qué puede hacer cada sesión.

### Aplicación manual sin instalar herramientas

1. Crea un proyecto Supabase desde el panel oficial. No hace falta comprar un plan para realizar estas pruebas; no actives servicios de pago.
2. En **SQL Editor**, abre una consulta nueva, copia y ejecuta primero el contenido de `20261011000100_initial_catalog_schema.sql`; después ejecuta `20261011000200_platform_super_admin.sql`. Confirma éxito en ambos casos. No vuelvas a ejecutar la migración inicial si ya se aplicó; en ese caso ejecuta solo la aditiva. La ejecución manual no se registra en el historial local de Supabase CLI.
3. En **Project Settings → Data API**, confirma que `public` esté entre los esquemas expuestos. Las versiones recientes no exponen automáticamente todas las tablas nuevas. Los grants explícitos y RLS son requisitos separados.
4. En **Authentication → Settings**, desactiva los registros públicos. En **Authentication → Providers**, habilita solo los métodos necesarios (para la primera versión, correo/contraseña); crea o invita usuarios desde **Authentication → Users**. No concedas roles según datos enviados por el navegador.
5. Crea primero el usuario en Authentication y copia su UUID desde la lista de usuarios. Para una cuenta super admin, usa el bloque global de abajo. Para un owner de restaurante, ejecuta el bloque de bootstrap de membresía. Ambos bloques deben ejecutarse en SQL Editor, nunca desde el frontend.
6. Mantén `is_active = false` durante la preparación. Tras comprobar datos y catálogo, el super admin puede activar el negocio; si aún no está conectado el panel, hazlo manualmente en SQL Editor.
7. Para registrar otro negocio, repite el bloque con un slug nuevo y usuario ya creado/invitado. Los clientes API no pueden insertar, cambiar ni borrar las filas de super admins o miembros.

### Asignar el super admin global

El super admin es una cuenta de Authentication autorizada manualmente; no se crea por registro público. Obtén su UUID en **Authentication → Users**, reemplázalo y ejecuta en SQL Editor:

```sql
insert into public.platform_admins (user_id)
values ('REEMPLAZAR-CON-UUID-DE-auth.users'::uuid)
on conflict (user_id) do nothing;
```

Para retirar acceso global, ejecuta en SQL Editor `delete from public.platform_admins where user_id = 'UUID-DE-LA-CUENTA'::uuid;`. El navegador no tiene permisos de escritura en esta tabla y el panel no toma el rol de `user_metadata`. El super admin puede ver y editar fichas, catálogos e imágenes de restaurantes conforme a las políticas RLS. La asignación o revocación de miembros/roles de restaurante sigue siendo una operación privilegiada manual; no puede autoasignarse ni crear más super admins desde la app.

Para este cambio usa la migración aditiva `20261011000200_platform_super_admin.sql`; no vuelvas a ejecutar la migración base si ya se aplicó. Tras ejecutar la migración aditiva, confirma que `public` siga expuesto a Data API; la migración concede `SELECT` sobre `platform_admins` solo al rol `authenticated` y RLS limita la lectura a la propia cuenta.

```sql
do $$
declare
	new_user_id uuid := 'REEMPLAZAR-CON-UUID-DE-auth.users'::uuid;
	new_restaurant_id uuid;
begin
	insert into public.restaurants (name, slug, is_active)
	values ('Nombre de demostración', 'restaurante-demo', false)
	returning id into new_restaurant_id;

	insert into public.restaurant_members (restaurant_id, user_id, role)
	values (new_restaurant_id, new_user_id, 'owner');
end;
$$;
```

### Límites de seguridad y Storage

- Visitantes anónimos solo pueden leer restaurantes activos, categorías activas y productos de esas categorías. Un producto no disponible sigue siendo visible para mostrar su estado.
- `owner` y `admin` pueden editar la ficha del negocio; `owner`, `admin` y `editor` pueden editar contenido. La autorización se verifica en RLS, no solo en la interfaz.
- Las políticas de membresía no admiten escrituras por el cliente. Dar o cambiar roles requiere una operación privilegiada manual. Hay como máximo un owner por restaurante.
- El bucket `restaurant-catalog` es público para servir imágenes del catálogo; subida, reemplazo y borrado requieren autenticación y membresía del restaurante. No guardes archivos privados allí.
- Los objetos deben vivir bajo `<restaurant-uuid>/logo/...`, `<restaurant-uuid>/cover/...` o `<restaurant-uuid>/products/...`. Storage limita las imágenes a 5 MiB y JPEG, PNG o WebP.
- Las políticas aún requieren validación contra dos cuentas y dos restaurantes antes de producción. El arnés local usa Supabase simulado y no certifica RLS.

### Claves

La web solo podrá usar la URL del proyecto y la clave pública `sb_publishable_…` (o la clave `anon` heredada), con estas políticas activas. La clave secreta `sb_secret_…` y la `service_role` nunca se ponen en JavaScript, HTML, repositorios ni variables que se empaqueten para el navegador. Si una clave secreta se compartió o publicó, revócala o rótala en el panel de Supabase antes de continuar. El proyecto contiene únicamente la clave publicable proporcionada.

## Estado de Supabase

La ruta `/admin/` incluye login, cierre de sesión, recuperación, selección de restaurante y edición de ficha, diseño y catálogo. `src/config.js` tiene URL y clave publicable. La última lectura anónima a `restaurants` falló porque la tabla no existía/estaba expuesta; por eso no se han validado todavía el login ni los permisos contra Supabase real. El CRUD de productos/categorías y las cargas, reemplazos y borrados de imágenes pasan el arnés local simulado. Tras aplicar las migraciones y revisar **Data API → Exposed schemas**, falta validar lectura pública, roles y aislamiento de restaurantes con cuentas reales.

### Configurar acceso para la fase 4

El archivo contiene únicamente valores públicos para el navegador:

```js
window.CATALOG_CONFIG = {
	supabaseUrl: 'https://TU-PROJECT-REF.supabase.co',
	publishableKey: 'sb_publishable_TU_CLAVE_PUBLICA',
};
```

1. Rota cualquier clave secreta que se haya compartido. `src/config.js` ya contiene la URL y la clave pública proporcionadas; confirma que la clave sea la `sb_publishable_…` de este mismo proyecto. Las claves publicables son visibles en el navegador por diseño; nunca pongas `sb_secret_…` ni `service_role` aquí.
2. En Supabase **Authentication → URL Configuration**, configura `http://127.0.0.1:4173` como URL del sitio y permite `http://127.0.0.1:4173/admin/` como URL de redirección para recuperación. En el hosting publicado registra también el origen y la ruta `/admin/` correspondientes.
3. Mantén desactivado el registro público. Crea/invita al usuario en Authentication y asígnale membresía como se describe en la sección de bootstrap de fase 3.
4. Inicia `node server.js`, abre `/admin/` e inicia sesión con una cuenta ya autorizada. El token de sesión se conserva en `sessionStorage` de esa pestaña, se renueva antes de expirar y se elimina al cerrar sesión.
5. Guarda datos y revisa la confirmación. El panel exige una respuesta `PATCH` con una fila devuelta por RLS; la interfaz no informa éxito si Supabase no confirmó el cambio.

La autenticación usa los endpoints REST/Auth de Supabase mediante `fetch`; no descarga SDK ni requiere instalación. Sin una cuenta autorizada no se pueden probar credenciales reales, correo de recuperación ni autorización remota. La fase 5 implementa CRUD de productos/categorías y manejo de imágenes; las pruebas locales usan un mock. El catálogo público consulta Supabase y muestra datos demo si la configuración o la tabla no están disponibles.