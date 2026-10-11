# Catálogos digitales multirrestaurante

Frontend estático de demostración, hecho con HTML, CSS y JavaScript nativos. No requiere `npm install`, paquetes ni compilación. Los restaurantes, platos, precios, horarios e imágenes del catálogo actual son contenido de demostración, no información de negocios reales.

## Probar en local

Se requiere una instalación existente de Node.js únicamente para el servidor local. Desde esta carpeta ejecuta:

```powershell
node server.js
```

Abre `http://127.0.0.1:4173/r/mesa-limon/` o `http://127.0.0.1:4173/r/patio-bruma/`. También puedes abrir `/admin/` para ver el aviso de que el panel aún no forma parte de esta fase. `server.js` usa solo módulos incluidos en Node y sirve `index.html` para las rutas de la aplicación.

## Rutas y hosting estático

La aplicación reconoce `/r/{slug}/` y `/admin/` leyendo `window.location.pathname`. Para que una ruta funcione al abrirla o recargarla directamente, el hosting debe devolver `index.html` para rutas sin archivo correspondiente. `_redirects` en la raíz incluye el fallback de Netlify; en otros hosts configura la regla equivalente según su documentación. El sitio no depende de esa configuración para su lógica de catálogo.

### GitHub Pages

Se añadió `.github/workflows/pages.yml`: al hacer push a `main`, GitHub Actions publica el sitio estático sin instalar dependencias ni ejecutar una compilación. `.nojekyll` evita transformaciones del árbol por Jekyll. `404.html` conserva rutas profundas como `/NOMBRE-DEL-REPOSITORIO/r/mesa-limon/`; `index.html` restaura esa ruta y mantiene el prefijo de proyecto en assets y enlaces. En GitHub, selecciona **Settings → Pages → Build and deployment → GitHub Actions**. Los enlaces profundos deben verificarse una vez que el repositorio esté publicado.

GitHub Pages sirve el contenido como sitio público. No publiques datos privados allí. La clave `sb_publishable` puede aparecer en el frontend únicamente con RLS correcta; la URL y la clave pública están configuradas, pero Auth no podrá operar correctamente hasta aplicar la migración y crear una membresía autorizada. Pages se prepara aquí para desarrollo/demostración; no se declara como proveedor comercial verificado.

No hay directorio de restaurantes en la raíz: entra directamente a `/Menus/r/{slug}/` o `/Menus/admin/`. Por ejemplo, el catálogo de demostración está en `https://osorioosiel990-design.github.io/Menus/r/mesa-limon/`.

El repositorio previsto es `osorioosiel990-design/Menus`, pero aún no se ha creado ni publicado: la autenticación GitHub disponible en este equipo caducó y el entorno no pudo conectar al servicio de device login. Cuando GitHub CLI tenga una sesión válida para `osorioosiel990-design`, crea el repo público (Pages gratuito requiere sitio público en este caso) y sube la rama `main`:

```powershell
gh auth login -h github.com
gh repo create Menus --public --source=. --remote=origin --push
```

Después verifica en **Settings → Pages** que la fuente sea **GitHub Actions**. El workflow `.github/workflows/pages.yml` publica en cada push a `main`; la URL esperada es `https://osorioosiel990-design.github.io/Menus/`. No ejecutes el despliegue hasta confirmar que el proyecto no contiene datos privados y que RLS está activa.

Slugs demo disponibles: `mesa-limon`, `patio-bruma` y `demo-inactivo`. Los otros slugs muestran un estado de catálogo inexistente. El buscador y los filtros se ejecutan en el navegador sobre los datos demo actuales.

## Base de datos Supabase (fase 3)

La migración versionada está en `supabase/migrations/20261011000100_initial_catalog_schema.sql`. Incluye restaurantes, miembros, categorías, productos, claves foráneas compuestas que impiden asignar productos a categorías de otro restaurante, índices, restricciones, RLS y el bucket `restaurant-catalog`.

### Aplicación manual sin instalar herramientas

1. Crea un proyecto Supabase desde el panel oficial. No hace falta comprar un plan para realizar estas pruebas; no actives servicios de pago.
2. En **SQL Editor**, abre una consulta nueva, copia el contenido de la migración completa y ejecútala. Confirma que el panel indica éxito antes de continuar. Esta ejecución manual no se registra automáticamente en el historial local de migraciones de Supabase CLI.
3. En **Authentication → Settings**, desactiva los registros públicos. En **Authentication → Providers**, habilita solo los métodos necesarios (para la primera versión, correo/contraseña); crea o invita usuarios desde **Authentication → Users**. No concedas roles según datos enviados por el navegador.
4. Crea primero el usuario en Authentication y copia su UUID desde la lista de usuarios. En SQL Editor ejecuta el bloque de bootstrap que sigue, reemplazando el UUID y el slug de ejemplo. El bloque debe ejecutarse con el rol privilegiado del SQL Editor, nunca desde el frontend.
5. Mantén `is_active = false` durante la preparación. Tras comprobar los datos y el catálogo, el owner podrá activar el restaurante desde el panel cuando esa función se implemente; en esta fase la activación puede hacerse manualmente en SQL Editor.
6. Para registrar otro negocio, repite el bloque con un slug nuevo y un usuario ya creado o invitado. Asigna cada miembro mediante SQL Editor. Los clientes API no tienen permisos para insertar, cambiar ni borrar filas en `restaurant_members`.

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
- El bucket `restaurant-catalog` es público para servir imágenes del catálogo. Por ello, cualquiera que tenga una URL de imagen puede leerla; subida, reemplazo y borrado requieren autenticación y membresía del restaurante. No guardes archivos privados allí.
- Cada objeto debe vivir bajo `<restaurant-uuid>/logo/...`, `<restaurant-uuid>/cover/...` o `<restaurant-uuid>/products/...`. `products.image_path` usa el formato `<restaurant-uuid>/products/<nombre-unico>.webp`. Storage limita a 5 MiB y a JPEG, PNG o WebP.
- La política limita cambios de objetos por carpeta y membresía. La migración no se ha ejecutado contra un proyecto real en este workspace, así que estos permisos requieren validación contra dos cuentas y dos restaurantes antes de producción.

### Claves

La web solo podrá usar la URL del proyecto y la clave pública `sb_publishable_…` (o la clave `anon` heredada), con estas políticas activas. La clave secreta `sb_secret_…` y la `service_role` nunca se ponen en JavaScript, HTML, repositorios ni variables que se empaqueten para el navegador. Si una clave secreta se compartió o publicó, revócala o rótala en el panel de Supabase antes de continuar. El proyecto contiene únicamente la clave publicable proporcionada.

## Alcance aún pendiente

La ruta `/admin/` ya incluye login, cierre de sesión, recuperación de contraseña, selección de restaurante y edición de ficha/colores mediante la API REST de Supabase. `src/config.js` tiene la Project URL y la clave publicable proporcionadas. Se comprobó una lectura anónima al API: el proyecto responde, pero `public.restaurants` aún no está en su esquema (`PGRST205`), por lo que no se ha confirmado la migración y el login/CRUD real todavía no se pueden validar.

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

La autenticación usa los endpoints REST/Auth de Supabase mediante `fetch`; no descarga SDK ni requiere instalación. Sin un proyecto configurado no se pueden probar credenciales reales, correo de recuperación ni autorización remota. La edición de productos/categorías y la carga de imágenes quedan pendientes para la fase 5; el catálogo público aún usa datos demo.