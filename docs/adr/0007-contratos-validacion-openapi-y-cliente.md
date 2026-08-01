# ADR-007: Contratos compartidos, validación, OpenAPI, cliente tipado y versionado de API

- Estado: Aceptado
- Fecha: 2026-07-30
- Responsables: Responsable del proyecto
- Fase/historia: Fase 0 — decisión bloqueante antes de Fase 1
- Sustituye a: Ninguno
- Sustituido por: Ninguno

## Contexto

Copiloto Financiero tendrá, como mínimo, una aplicación móvil React Native/Expo, una API REST NestJS, herramientas tipadas para el asistente de IA, documentación OpenAPI y pruebas de contrato. Un panel web podría consumir la misma API después del MVP.

Sin una estrategia común, cada consumidor podría definir de manera independiente sus interfaces, DTO, validaciones, errores y supuestos de compatibilidad. Eso permitiría que:

- el móvil compile contra una forma que la API no acepta o no devuelve;
- los DTO de NestJS diverjan de los tipos compartidos;
- OpenAPI describa un comportamiento distinto al implementado;
- una validación TypeScript se confunda con validación en tiempo de ejecución;
- el cliente importe clases o dependencias internas del backend;
- contratos públicos expongan modelos de persistencia;
- reglas financieras terminen duplicadas dentro de esquemas de transporte;
- un generador degrade la representación exacta del dinero;
- una actualización de servidor rompa versiones móviles ya instaladas;
- el texto localizado de un error se convierta accidentalmente en una interfaz de control.

Esta decisión fija la dirección arquitectónica y la librería inicial de schemas antes de crear el monorepo, sin fijar versiones ni diseñar una API financiera completa. El ADR-001 ya establece que el código, la API y los contratos usan inglés; los campos JSON y las tools usan `camelCase`; los tipos y schemas usan `PascalCase`; las rutas REST usan inglés; y los errores públicos separan un `code` estable de un `message` localizable.

ADR-007 define límites y flujo de artefactos. Su aceptación no crea `packages/contracts`, no instala herramientas y no inicia la Fase 1; esa fase requiere una tarea expresamente autorizada.

## Alcance

Este ADR define:

- la fuente de verdad de los contratos públicos;
- la responsabilidad y organización conceptual de `packages/contracts`;
- la relación entre schemas ejecutables, tipos TypeScript, adaptadores NestJS y OpenAPI;
- los límites de validación de entrada y salida;
- la estrategia futura del cliente móvil;
- reglas iniciales de versionado y compatibilidad;
- la forma conceptual de los errores públicos;
- la reutilización segura de contratos por tools de IA;
- controles futuros de pruebas y CI.

Este ADR no decide:

- representación, precisión, redondeo, división o serialización definitiva de dinero, reservados para ADR-002;
- autenticación y ciclo de tokens, reservados para ADR-005;
- autorización, roles, visibilidad y aislamiento, reservados para ADR-006;
- semántica y alcance de idempotencia, reservados para ADR-008;
- fechas financieras, zonas horarias y periodos, reservados para ADR-009;
- catálogo, prompts, modelo, retención o comportamiento detallado de tools, reservados para ADR-012;
- endpoints financieros concretos, modelos de persistencia o reglas del ledger;
- una versión concreta de Zod;
- el adaptador NestJS, mecanismo de OpenAPI, generador de cliente o plugin concretos.

Puede reservar puntos de extensión para esas decisiones, pero no fijar su semántica.

## Restricciones y criterios

### Principios obligatorios

1. `packages/contracts` será la fuente compartida de las formas públicas de requests, responses, parámetros, errores, eventos y tools cuando corresponda.
2. Los schemas ejecutables, y no interfaces TypeScript aisladas, serán la fuente de los tipos públicos.
3. `packages/contracts` será independiente de NestJS, Prisma, React Native y el proveedor de IA.
4. Las invariantes financieras permanecerán en `packages/domain` y en los servicios de aplicación.
5. Validar una forma en el límite no sustituirá validar reglas de dominio.
6. El servidor volverá a validar toda entrada, aunque el cliente use tipos y validación local.
7. El móvil no importará controladores, entidades de persistencia, servicios ni clases internas de NestJS.
8. OpenAPI describirá la API implementada y no será una segunda definición manual de las mismas formas.
9. Los errores públicos usarán códigos estables en inglés, mensajes localizables y metadata segura.
10. Ningún contrato monetario usará `float`.
11. Existirá un schema canónico `Money` o equivalente, pero su representación exacta queda pendiente de ADR-002 y no se asumirá que sea un JSON `number`.
12. Los contratos permitirán pruebas de contrato, evolución compatible, cliente tipado y composición futura de tools.
13. Zod será la librería inicial de schemas de `packages/contracts`, sin una versión fijada por este ADR.

### Criterios de comparación

Las alternativas se comparan por:

- existencia de una sola fuente de verdad;
- independencia de frameworks;
- experiencia de desarrollo;
- validación en tiempo de ejecución;
- compatibilidad con NestJS y Expo;
- derivación de OpenAPI;
- construcción o generación del cliente;
- mantenibilidad;
- capacidad de prueba;
- versionado y compatibilidad hacia atrás;
- reutilización por un panel web futuro;
- composición de tools de IA;
- costo de adopción o migración;
- riesgo de deriva;
- impacto en el bundle y runtime móvil;
- capacidad de conservar formatos exactos como dinero y fechas.

## Opciones consideradas

### Alternativa A: clases y decoradores de NestJS como fuente de verdad

Los DTO se expresan como clases de NestJS con validadores y decoradores de Swagger. NestJS genera OpenAPI y el cliente móvil se genera desde esa especificación.

Ventajas:

- integración directa con el ciclo de request de NestJS;
- experiencia conocida dentro del backend;
- documentación de rutas próxima a los controladores;
- generación de OpenAPI y cliente apoyada en herramientas habituales.

Desventajas y riesgos:

- la fuente de verdad queda acoplada al framework del servidor;
- Expo no puede reutilizar las clases sin incorporar dependencias o semántica del backend;
- los tipos compartidos y DTO pueden duplicarse;
- decoradores de validación y de documentación pueden divergir;
- transformaciones implícitas de clases pueden ocultar coerciones;
- cambiar NestJS o su herramienta de documentación impactaría todos los contratos;
- la validación de responses suele requerir trabajo adicional;
- existe riesgo de que el cliente generado represente dinero con un tipo inexacto.

La alternativa reduce fricción local en la API, pero contradice el límite de no compartir clases de framework con el móvil.

### Alternativa B: schemas TypeScript compartidos como fuente de verdad

`packages/contracts` contiene schemas ejecutables independientes del framework. Los tipos TypeScript se infieren de esos schemas. NestJS los consume mediante adaptadores delgados; OpenAPI se deriva de la misma definición; Expo consume los tipos, schemas seleccionados o un cliente tipado derivado.

Ventajas:

- una fuente común para forma estática y validación runtime;
- independencia de NestJS, Prisma y React Native;
- reutilización selectiva entre API, móvil, tools y un panel futuro;
- validación simétrica de requests y responses;
- contratos fáciles de probar sin levantar frameworks;
- composición explícita de formatos y errores comunes;
- menor riesgo de que los DTO reescriban una forma ya definida.

Desventajas y riesgos:

- requiere adaptadores para conectar schemas, rutas NestJS y documentación;
- no todas las restricciones de un schema se representan fielmente en OpenAPI;
- la librería elegida debe funcionar en Node.js y Expo/Hermes;
- enviar schemas runtime al móvil puede aumentar el bundle;
- el equipo debe definir una política clara para transformaciones y refinamientos;
- un adaptador incompleto puede producir documentación o errores deficientes.

Esta alternativa satisface mejor la independencia de capas y la validación compartida, siempre que OpenAPI y los adaptadores sean reproducibles.

### Alternativa C: OpenAPI-first

Una especificación OpenAPI escrita como fuente principal genera tipos, cliente y esqueletos o adaptadores del servidor.

Ventajas:

- contrato HTTP explícito e independiente del lenguaje;
- ecosistema amplio de documentación, diff y generación;
- buena base para consumidores externos y un panel futuro;
- revisión temprana de paths, estados y payloads.

Desventajas y riesgos:

- la especificación manual puede resultar verbosa y separada del código que valida;
- los tipos generados no aportan por sí solos validación runtime;
- restricciones o transformaciones complejas pueden no expresarse sin extensiones;
- las invariantes financieras siguen necesitando dominio independiente;
- la experiencia de autoría puede ser menos natural para un equipo TypeScript;
- si el servidor no se genera o valida estrictamente, la especificación también puede divergir;
- los artefactos generados pueden ser grandes o poco adecuados para Expo.

Es una alternativa disciplinada, pero no resuelve por sí sola la validación ejecutable ni elimina el riesgo de divergencia entre especificación y runtime.

### Alternativa D: contratos separados y manuales por aplicación

NestJS mantiene sus DTO, Expo sus interfaces y OpenAPI se actualiza de forma independiente.

Ventajas:

- ausencia de tooling compartido inicial;
- libertad local para cada aplicación;
- arranque aparente más sencillo.

Desventajas y riesgos:

- tres o más fuentes para la misma forma;
- alta probabilidad de divergencia entre API, móvil y documentación;
- correcciones repetidas y pruebas más costosas;
- validación inconsistente;
- cambios incompatibles difíciles de detectar;
- mayor riesgo de exponer campos internos;
- mala reutilización por tools o un panel futuro;
- costo de migración creciente con cada endpoint.

Esta alternativa no cumple el criterio de una sola fuente de verdad.

### Alternativa E: schemas compartidos y OpenAPI mantenido manualmente

Los tipos y la validación se derivan de schemas compartidos, pero OpenAPI se escribe por separado.

Ventajas:

- conserva validación runtime compartida;
- permite documentar detalles HTTP sin restricciones de un adaptador;
- evita depender de un generador concreto.

Desventajas y riesgos:

- crea dos fuentes independientes para cada payload;
- cada refinamiento o cambio exige sincronización manual;
- el CI solo detectaría la divergencia con pruebas adicionales difíciles de completar;
- aumenta el riesgo de documentación obsoleta y clientes incorrectos.

La alternativa mejora sobre contratos totalmente separados, pero no cumple el objetivo de evitar dos fuentes de verdad.

### Comparación resumida

| Criterio | A: NestJS-first | B: schema-first compartido | C: OpenAPI-first | D: manual separado | E: schemas + OpenAPI manual |
|---|---|---|---|---|---|
| Fuente única | Parcial, centrada en backend | Alta | Alta si todo se genera | No | Parcial |
| Independencia de framework | Baja | Alta | Alta | Variable | Alta para schemas |
| Validación runtime | Alta en request; response variable | Alta y reutilizable | Requiere tooling adicional | Inconsistente | Alta |
| Compatibilidad NestJS/Expo | Baja para compartir directamente | Alta con adaptadores | Alta mediante generación | Manual | Alta con duplicación documental |
| Fidelidad de OpenAPI | Dependiente de decoradores | Dependiente del adaptador, verificable | Nativa | Manual | Manual |
| Cliente móvil | Generado | Generado, manual tipado o híbrido | Generado | Manual duplicado | Manual o generado |
| Tools y panel futuro | Acoplados o derivados | Composición reutilizable | Derivados | Duplicados | Composición parcial |
| Riesgo de deriva | Medio | Bajo con CI | Bajo si el runtime se verifica | Muy alto | Medio/alto |
| Costo inicial | Bajo/medio | Medio | Medio/alto | Bajo aparente | Medio |
| Costo de evolución | Medio/alto | Bajo/medio | Medio | Alto | Medio/alto |

## Decisión

Se acepta la **Alternativa B**:

> Schemas ejecutables Zod, independientes del framework y alojados en `packages/contracts`, serán la fuente de verdad de las formas públicas. Los tipos TypeScript se inferirán de esos schemas. NestJS usará adaptadores delgados, OpenAPI se derivará de los mismos contratos y el cliente móvil usará inicialmente un cliente REST manual, pequeño y tipado, sin incorporar reglas de negocio ni clases del servidor.

La aceptación de esta estrategia no autoriza por sí sola crear el paquete, instalar Zod, generar archivos ni implementar endpoints. Ese trabajo pertenece a una Fase 1 expresamente autorizada.

### Fuente de verdad y flujo de artefactos

La relación aprobada es:

1. Un schema base público y su metadata contractual se autoran una sola vez con Zod en `packages/contracts`.
2. El tipo TypeScript se infiere del schema; no se mantiene una interfaz paralela con la misma forma.
3. El servidor deriva del schema base una variante estricta para validar requests y validar o serializar responses.
4. El cliente deriva del mismo schema base una variante compatible que acepta campos adicionales seguros en responses.
5. Los objetos expresamente cerrados por seguridad permanecen cerrados también en el cliente.
6. Un adaptador delgado de NestJS usa la variante correspondiente para validar el límite HTTP y asociarlo con la ruta.
7. OpenAPI se deriva de los schemas y de la metadata de transporte correspondiente.
8. El cliente REST manual usa los tipos y schemas derivados.
9. Las pruebas verifican que servidor, OpenAPI y cliente permanecen alineados.

Los contratos son fuente de verdad de las formas públicas. Los controladores pueden conservar el enlace entre HTTP y caso de uso, pero no redefinen campos, enums o errores. OpenAPI es un artefacto contractual verificable y reproducible, no una especificación manual paralela.

La variante estricta del servidor y la variante compatible del cliente no son schemas manuales independientes: ambas se construyen desde el mismo schema base canónico. El servidor debe impedir que una response filtre campos internos por accidente. El cliente puede tolerar adiciones compatibles, pero debe rechazar cambios incompatibles de tipo, formato o semántica.

### Subconjunto contractual representable

Los schemas públicos deben permanecer dentro de un subconjunto que pueda derivarse de forma confiable hacia OpenAPI/JSON Schema.

En schemas públicos se evitarán:

- transformaciones ocultas;
- coerciones implícitas;
- defaults con efecto semántico no documentado;
- refinamientos imposibles de expresar fielmente;
- efectos secundarios;
- reglas financieras;
- autorización;
- acceso a datos.

Cuando una regla no pueda expresarse fielmente en OpenAPI:

- permanecer en el schema ejecutable;
- documentar explícitamente la limitación y cualquier representación aproximada o extensión segura;
- tener pruebas runtime;
- no producir en OpenAPI una garantía engañosa.

Las invariantes de dominio siempre se validan fuera del contrato, aunque una restricción superficial pueda documentarse también en OpenAPI.

### Responsabilidad de `packages/contracts`

La organización conceptual inicial es:

```text
packages/contracts/
  src/
    common/
    errors/
    households/
    financial-accounts/
    financial-transactions/
    assistant/
    index.ts
```

Esta estructura no se crea mediante este ADR. Los módulos financieros solo deberán aparecer en su fase y después de aceptar sus ADR bloqueantes.

El paquete puede contener:

- schemas de request, response y parámetros;
- tipos públicos inferidos;
- códigos de error y envelopes públicos;
- enums serializados cerrados;
- formatos comunes y aliases semánticos;
- metadata necesaria para derivar OpenAPI;
- contratos de eventos públicos cuando exista su fase;
- contratos de tools cuando exista su fase;
- funciones puras estrictamente limitadas a parsear o serializar el contrato, si la herramienta elegida las requiere.

El paquete no puede contener:

- entidades ni tipos generados por Prisma;
- tablas, repositorios o consultas;
- modelos internos o agregados de dominio;
- servicios de NestJS o servicios de aplicación;
- reglas de saldo, ledger, redondeo, disponibilidad o autorización;
- cálculos financieros;
- lógica de idempotencia;
- llamadas al proveedor de IA;
- componentes, hooks o estado de UI;
- secretos, credenciales o configuración sensible.

Un nombre compartido no obliga a que el dominio y el transporte sean el mismo objeto. Los servicios de aplicación realizarán mapeos explícitos cuando el modelo interno tenga garantías o datos que no deban exponerse.

### Librería inicial de schemas

Zod es la librería inicial para los schemas ejecutables de `packages/contracts`.

- Este ADR no fija una versión concreta.
- La versión se elegirá en Fase 1 según compatibilidad con el runtime, NestJS, Expo/Hermes, ESM y el toolchain del monorepo.
- Zod dentro de `packages/contracts` no podrá importar NestJS, Prisma, Expo, React Native, OpenAI ni otro proveedor de IA.
- Los tipos públicos se inferirán desde schemas Zod.
- No existirán interfaces paralelas que redefinan la misma forma.
- Los schemas públicos respetarán el subconjunto contractual representable definido en este ADR.

La prueba técnica acotada de Fase 1 seleccionará:

- adaptador entre schemas y NestJS;
- mecanismo para derivar OpenAPI;
- herramienta de diff de cambios incompatibles;
- generador de cliente, únicamente si después se evalúa esa evolución;
- política de conservar o regenerar artefactos derivados.

Estas elecciones son detalles de implementación dentro de la estrategia aceptada y no requieren otro ADR. Se documentará otro ADR solo si la prueba obliga a abandonar Zod como fuente de schemas, convierte OpenAPI en fuente primaria, acopla contratos a un framework o cambia otra parte sustancial de la estrategia arquitectónica.

### OpenAPI

OpenAPI será la descripción pública verificable de la API, derivada de los contratos y metadata de transporte. No será una fuente primaria escrita de manera independiente.

El adaptador NestJS y el mecanismo exacto de derivación se elegirán mediante la prueba técnica acotada de Fase 1. Esa elección debe preservar a los schemas Zod como fuente canónica y demostrar una derivación fiel; no puede introducir una especificación paralela.

La estrategia futura deberá:

- producir el documento de forma determinista;
- incluir paths, métodos, parámetros, cuerpos, responses, códigos públicos y estados HTTP;
- asociar cada operación con sus schemas compartidos;
- usar ejemplos completamente ficticios;
- excluir secretos, tokens, datos personales y datos financieros reales;
- fallar en CI si la generación no es reproducible o el artefacto conservado está desactualizado;
- ejecutar un diff contractual contra la referencia de la rama base;
- clasificar cambios compatibles e incompatibles;
- permitir publicación futura con acceso y entorno definidos;
- comprobar, mediante pruebas de contrato, que las respuestas implementadas cumplen su schema.

La metadata específica de rutas no debe duplicar las formas. Si NestJS conserva metadata operativa que no pertenece al contrato compartido, el generador combinará ambas fuentes solo para aspectos distintos: `packages/contracts` define payloads y errores; el adaptador enlaza esos contratos a las operaciones implementadas. Ninguna capa podrá declarar una segunda forma independiente.

La publicación de OpenAPI no implica que todos los endpoints sean públicos en Internet. Su exposición, autenticación y controles se resolverán según ADR-005, ADR-006 y la política de despliegue.

### Cliente móvil

El primer incremento usará un cliente REST manual, pequeño, tipado y desacoplado:

- requests, responses y errores provienen de `packages/contracts`;
- usa tipos y schemas derivados de la fuente canónica;
- ofrece la interfaz de transporte que usa Expo;
- mantiene el transporte inyectable e intercambiable;
- maneja errores públicos de manera uniforme;
- incluye timeout y cancelación;
- se cubre con pruebas de schema y contrato.

El cliente deberá soportar:

- tipos de parámetros, requests y responses;
- decodificación uniforme de errores públicos;
- cancelación de requests;
- timeouts explícitos;
- inyección de transporte y configuración;
- pruebas de contrato;
- correlación segura cuando corresponda;
- compatibilidad con más de una versión de API durante una migración aprobada.

El cliente no contendrá reglas financieras, autorización, cálculos, modelos de persistencia ni acceso directo a NestJS. Los tipos TypeScript ayudan al desarrollo, pero no son una barrera de seguridad: el servidor valida nuevamente la entrada, aplica autorización, ejecuta dominio e idempotencia y controla la persistencia.

La generación completa desde OpenAPI queda como evolución posible, no como estrategia inicial. Antes de adoptarla se evaluarán:

- ergonomía;
- tamaño de bundle;
- compatibilidad con Expo;
- manejo de errores;
- timeout y cancelación;
- representación de `Money` después de ADR-002;
- mantenibilidad y reproducibilidad.

No se mantendrán dos clientes de producción paralelos. Si un cliente generado sustituye al manual, la migración será explícita y conservará las mismas capas consumidoras y pruebas de contrato.

### Versionado y compatibilidad de la API

La API HTTP inicial usará el prefijo `/api/v1`.

La versión de API es independiente de la versión de la aplicación móvil:

- publicar una nueva app no cambia automáticamente la versión de API;
- desplegar el backend no permite asumir que todos los móviles se actualizaron;
- el servidor deberá conservar compatibilidad con las versiones móviles soportadas;
- la matriz de versiones soportadas y su ventana temporal será una decisión operativa antes de producción.

Dentro de `v1`, los cambios deberán ser compatibles hacia atrás. Son normalmente compatibles:

- agregar un endpoint nuevo;
- agregar un parámetro de request opcional con comportamiento por defecto documentado;
- agregar un campo opcional de response, siempre que los clientes estén obligados a ignorar campos desconocidos;
- agregar un código de error nuevo solo cuando el cliente tenga una conducta segura por defecto.

Son incompatibles, salvo evidencia y migración explícitas:

- eliminar o renombrar un endpoint, campo o código de error;
- cambiar tipo, formato, unidad, precisión, nulabilidad o significado;
- convertir un campo opcional en requerido;
- exigir un parámetro que antes no existía;
- quitar un valor de enum o agregar uno a un enum cerrado que los clientes tratan exhaustivamente;
- cambiar estados HTTP o semántica de reintento de manera observable;
- cambiar la representación de `Money`, fechas, IDs o paginación;
- hacer más restrictiva una validación que rechace requests antes válidos;
- exponer una respuesta con reglas de autorización distintas.

El servidor derivará del schema base canónico una variante estricta y serializará solo sus campos declarados para impedir filtraciones accidentales. El cliente derivará del mismo schema base una variante que valide los campos conocidos y tolere campos adicionales compatibles, salvo en estructuras expresamente cerradas por seguridad. Esta asimetría derivada permite agregar campos sin duplicar schemas, filtrar internals ni romper móviles instalados.

Un cambio incompatible requerirá:

1. definir una nueva versión o una transición compatible;
2. documentar deprecación y reemplazo;
3. instrumentar adopción sin registrar datos sensibles;
4. conservar el endpoint anterior durante la ventana de soporte;
5. actualizar contratos, OpenAPI, cliente y pruebas;
6. retirar solo cuando las versiones móviles soportadas ya no dependan de él.

No se eliminará silenciosamente un endpoint usado por una versión móvil soportada. La política temporal concreta de deprecación se fijará antes de publicar clientes reales y deberá considerar distribución gradual, usuarios sin actualización automática y capacidad de rollback.

Eventos y tools tendrán identificadores de versión propios cuando corresponda. No se asumirá que su versión coincide con `/api/v1`; ADR posteriores decidirán su semántica. Un cambio incompatible en un contrato de evento o tool también exige transición explícita.

### Errores públicos

Los errores públicos usarán conceptualmente:

- `code`: identificador estable en inglés y `SCREAMING_SNAKE_CASE`;
- `message`: explicación localizable para personas;
- `metadata`: datos estructurados mínimos y seguros;
- `correlationId`: identificador opaco de soporte cuando corresponda.

Reglas:

- el cliente decide comportamiento mediante `code`, nunca comparando `message`;
- cambiar el idioma o redacción de `message` no cambia el contrato;
- `metadata` no revela la existencia de recursos inaccesibles, IDs internos, consultas, stack traces, nombres de tablas, datos de otras personas ni entradas sensibles;
- excepciones internas no se serializan directamente;
- errores desconocidos se traducen a un código público seguro;
- los errores de validación siguen una estructura consistente, con issues identificables por un path público y un código estable;
- los issues no repiten valores sensibles ni cuerpos completos;
- el mismo tipo de fallo conserva semántica y estado HTTP estables dentro de una versión;
- localización y observabilidad no deben convertir el mensaje en dato autoritativo.

Los códigos concretos aparecerán con cada módulo; este ADR define su convención, no un catálogo completo.

### Validación de entrada y salida

La validación de contrato ocurre en tiempo de ejecución en todos los límites no confiables.

Para requests y argumentos de tools se exige:

- rechazar propiedades inesperadas en comandos de escritura y en objetos cerrados;
- declarar explícitamente cualquier objeto extensible;
- evitar coerción implícita; permitir solo coerciones documentadas y controladas en el adaptador;
- limitar longitudes, número de elementos, profundidad y tamaño;
- tratar IDs como valores opacos, sin inferir permisos ni información de su contenido;
- usar enums cerrados y manejar su evolución como contrato;
- validar sintaxis de códigos de moneda sin convertir esa sintaxis en una regla de soporte;
- validar fechas solo según el formato que defina ADR-009;
- validar dinero mediante un `Money` canónico solo después de ADR-002;
- no asumir que un valor monetario es `number`;
- tratar argumentos del modelo de IA como datos no confiables;
- limitar y normalizar texto únicamente cuando la regla esté documentada.

Para responses se exige:

- serializar desde modelos de salida explícitos, nunca desde entidades ORM;
- validar respuestas financieras y de seguridad críticas antes de enviarlas, al menos en pruebas y en los puntos runtime definidos por riesgo;
- verificar que errores y responses coincidan con OpenAPI;
- impedir propiedades no declaradas en la salida del servidor;
- permitir que clientes compatibles ignoren adiciones seguras en responses.

La política exacta de validación runtime de todas las responses deberá equilibrar seguridad, desempeño y observabilidad. Nunca podrá omitirse en pruebas de contrato para operaciones críticas.

### Separación de validaciones

| Capa | Responsabilidad | No sustituye |
|---|---|---|
| Contrato | Forma, tipo runtime, presencia, tamaño, formato y propiedades permitidas | Reglas financieras, autorización o persistencia |
| Dominio | Invariantes financieras, estados válidos y cálculos exactos | Identidad o permisos |
| Autorización | Acceso al hogar, recurso, operación y visibilidad | Validez financiera |
| Idempotencia y concurrencia | Reintentos, duplicados, exclusión y consistencia de la intención | Autorización o balance del ledger |
| Persistencia | Constraints, atomicidad, integridad referencial y durabilidad | Validación completa de negocio |

Una entrada puede cumplir el schema y aun así ser rechazada por dominio, autorización, idempotencia o persistencia. El orden concreto de controles se documentará en los ADR y servicios correspondientes sin debilitar ninguna capa.

### Dinero, moneda y fechas

`packages/contracts` reservará un schema canónico `Money` o nombre equivalente para impedir representaciones ad hoc. ADR-002 decidirá:

- representación JSON;
- unidad y precisión;
- moneda;
- redondeo;
- división;
- serialización y compatibilidad.

Hasta entonces:

- no se estabilizarán contratos financieros con importes;
- no se usará `float`;
- no se asumirá JSON `number`;
- generadores de OpenAPI o cliente no decidirán el tipo por defecto;
- los ejemplos no fijarán una representación monetaria definitiva.

De forma análoga, ADR-009 decidirá formatos y semántica de fechas financieras, zonas horarias y periodos. ADR-007 solo exige que, una vez decididos, existan formatos compartidos y validación consistente.

### Contratos de tools de IA

Cuando llegue su fase, las tools:

- reutilizarán o compondrán schemas de aplicación, sin copiar formas manualmente;
- usarán nombres y argumentos `camelCase`;
- tendrán un identificador o versión de contrato;
- tratarán toda salida del modelo como entrada no confiable;
- no usarán `householdId` como prueba de autorización;
- no ofrecerán primitivas genéricas de escritura;
- llamarán servicios de aplicación, nunca repositorios o base de datos;
- distinguirán operaciones de lectura, borrador, preview y confirmación;
- devolverán errores públicos seguros;
- no convertirán la memoria o el texto del modelo en fuente de verdad financiera.

Este ADR no define el catálogo, prompts, modelo, confirmaciones concretas ni políticas de retención de tools. Esas decisiones permanecen en ADR-012 y en los ADR de dominio correspondientes.

## Consecuencias

### Positivas

- API, móvil, OpenAPI y tools parten de una forma pública común.
- La validación runtime y los tipos TypeScript evolucionan juntos.
- NestJS y Expo permanecen desacoplados entre sí.
- Los contratos pueden probarse sin frameworks ni persistencia.
- OpenAPI y el cliente se vuelven artefactos reproducibles.
- Los errores pueden localizarse sin romper lógica del cliente.
- La compatibilidad con móviles instalados se trata como requisito.
- Un panel web futuro puede consumir los mismos contratos públicos.
- Las invariantes financieras permanecen en el dominio.
- La representación monetaria no queda decidida accidentalmente por un generador.
- Zod fija una herramienta inicial sin acoplar contratos a NestJS ni Expo.
- Servidor estricto y cliente compatible derivan de un único schema base.
- El cliente manual inicial permite validar el límite de transporte antes de adoptar generación completa.

### Negativas

- La integración schema/NestJS/OpenAPI exige adapters y configuración.
- La versión de Zod y las herramientas de integración requieren una prueba técnica.
- Parte de la metadata HTTP puede necesitar una capa de enlace explícita.
- Los artefactos generados aumentan controles de CI y revisión.
- Validar responses runtime tiene costo de desempeño y debe aplicarse según riesgo.
- Enviar schemas al móvil puede incrementar el bundle.
- El equipo deberá aprender a clasificar cambios compatibles e incompatibles.
- OpenAPI puede ser menos expresivo que algunos refinamientos runtime.

### Riesgos

- Elegir una versión de Zod o un adaptador que no funcione bien con NestJS o Expo/Hermes.
- Permitir que DTO de NestJS vuelvan a definir schemas en paralelo.
- Introducir transformaciones runtime que OpenAPI no represente.
- Generar un cliente que convierta `Money` en un tipo inexacto.
- Tratar tipos TypeScript como control de seguridad.
- Compartir modelos internos bajo la etiqueta de contratos.
- Validar solo requests y permitir responses con campos accidentales.
- Rechazar campos adicionales en el cliente y romper cambios aditivos.
- Mantener artefactos generados desactualizados.
- Considerar compatible un nuevo valor de enum cerrado.
- Publicar ejemplos con datos personales o financieros reales.
- Confundir `householdId` con autorización.
- Estabilizar contratos financieros antes de ADR-002 o ADR-009.
- Elegir un adaptador que no derive OpenAPI fielmente desde Zod.
- Implementar manualmente variantes de servidor y cliente hasta convertirlas en fuentes divergentes.

### Mitigaciones

- probar la versión de Zod y cada adaptador candidato contra NestJS y Expo antes de adoptarlos;
- prohibir imports de framework o persistencia desde `packages/contracts`;
- agregar pruebas de arquitectura y dependencias;
- generar OpenAPI en CI y comparar el resultado;
- probar requests, responses, errores y cliente contra los mismos fixtures ficticios;
- revisar explícitamente cambios de enums, formatos y semántica;
- conservar un registro de compatibilidad de versiones móviles;
- derivar variantes estrictas y compatibles desde un único schema base;
- serializar responses del servidor mediante una lista permitida;
- bloquear contratos monetarios definitivos hasta ADR-002;
- bloquear formatos financieros definitivos de fecha hasta ADR-009.

### Trabajo derivado

En una Fase 1 autorizada y en las fases posteriores correspondientes se deberá:

1. elegir una versión concreta de Zod con evidencia de compatibilidad;
2. ejecutar primero la prueba contractual no financiera de health/readiness definida en este ADR;
3. seleccionar el adaptador NestJS sin introducir dependencias de NestJS en contratos;
4. definir el pipeline reproducible de OpenAPI;
5. construir el cliente REST manual, pequeño y tipado;
6. configurar pruebas de schemas y contratos;
7. configurar detección de OpenAPI y artefactos derivados desactualizados;
8. configurar revisión de breaking changes;
9. evaluar la generación completa del cliente solo como evolución;
10. documentar la matriz de compatibilidad móvil antes de una publicación real;
11. agregar módulos contractuales solo cuando su fase lo requiera;
12. incorporar `Money` y formatos de fecha únicamente después de sus ADR;
13. incorporar tools únicamente durante su fase.

Nada de este trabajo se ejecuta en esta tarea documental.

## Validación

La aprobación explícita del responsable del proyecto confirma:

- la Alternativa B y los schemas ejecutables compartidos como fuente canónica;
- Zod como librería inicial, sin versión fijada;
- tipos TypeScript inferidos sin interfaces paralelas;
- independencia de NestJS, Prisma, Expo y OpenAI;
- adaptadores delgados para NestJS;
- OpenAPI derivado de los mismos contratos;
- subconjunto público representable hacia OpenAPI/JSON Schema;
- variantes estricta de servidor y compatible de cliente derivadas del mismo schema base;
- cliente REST inicial manual, pequeño, tipado y desacoplado;
- prefijo inicial `/api/v1`;
- exactitud monetaria pendiente de ADR-002;
- fechas financieras y periodos pendientes de ADR-009.

La evidencia futura de la decisión deberá incluir:

- `typecheck` de productores y consumidores;
- pruebas unitarias de parseo válido e inválido de cada schema;
- pruebas de rechazo de propiedades inesperadas y coerción no autorizada;
- pruebas de límites de tamaño, IDs opacos y enums;
- pruebas de contrato entre API y OpenAPI;
- generación reproducible de OpenAPI;
- fallo de CI ante un artefacto derivado desactualizado;
- diff que identifique cambios incompatibles;
- pruebas del cliente móvil para requests, responses, errores, cancelación y timeout;
- validación de responses críticas;
- verificación de que los ejemplos son ficticios;
- escaneo y revisión de ausencia de secretos o datos sensibles;
- prueba de que ninguna dependencia prohibida llega a `packages/contracts`;
- prueba de que el servidor revalida datos aunque el cliente esté tipado;
- prueba de que `Money` no se reduce a `float` ni a una elección previa a ADR-002.

La selección del adaptador NestJS, el mecanismo exacto de OpenAPI y cualquier generador futuro de cliente permanece sujeta a la prueba técnica de Fase 1.

Escenarios de revisión:

1. Un campo cambia una sola vez en su schema y el tipo, OpenAPI, adaptador y cliente reflejan el cambio de forma reproducible.
2. Un móvil antiguo ignora un campo opcional nuevo de response y conserva su comportamiento.
3. Un request con una propiedad inesperada se rechaza en el límite sin llegar al dominio.
4. Un request válido por schema pero inválido financieramente se rechaza en dominio.
5. Un usuario sin acceso recibe un error seguro que no confirma la existencia del recurso.
6. Un argumento de tool se valida nuevamente y no usa `householdId` como autorización.
7. Una herramienta de generación intenta representar `Money` como número inexacto y la revisión bloquea el cambio.
8. OpenAPI generado contiene solo ejemplos ficticios y coincide con las responses observadas en pruebas.

## Plan de adopción o migración

1. Registrar ADR-007 como **Aceptado** y sincronizar sus referencias de estado.
2. No iniciar scaffolding hasta una Fase 1 autorizada por separado.
3. Elegir en Fase 1 una versión de Zod según compatibilidad, sin cambiar la estrategia aceptada.
4. Realizar como primera comprobación contractual un flujo de health/readiness o equivalente.
5. Para esa comprobación, crear un schema compartido, validarlo en NestJS mediante un adaptador, derivar OpenAPI, consumirlo desde un cliente REST tipado mínimo y cubrirlo con pruebas de schema y contrato.
6. No introducir ledger, dinero, autenticación real ni funcionalidad financiera en esa prueba.
7. Agregar controles de dependencias y generación reproducible antes de contratos financieros.
8. Esperar ADR-002 y ADR-009 antes de estabilizar importes y fechas financieras.
9. Incorporar autenticación, autorización e idempotencia solo después de ADR-005, ADR-006 y ADR-008.
10. Versionar cambios incompatibles y mantener la versión anterior durante la ventana de soporte definida.
11. Si la estrategia se sustituye, migrar contrato por contrato, conservar compatibilidad y registrar un ADR sustituto.

Actualmente no hay código, contratos implementados, clientes, especificación OpenAPI ni datos que migrar. Si esta decisión cambia después de implementarse, otro ADR la sustituirá y definirá la migración; no se reescribirá este registro para ocultar la decisión anterior.

## Referencias

- [`AGENTS.md`](../../AGENTS.md)
- [`README.md`](../../README.md)
- [`docs/00-index.md`](../00-index.md)
- [`docs/02-domain-rules.md`](../02-domain-rules.md)
- [`docs/03-mvp-scope.md`](../03-mvp-scope.md)
- [`docs/04-architecture.md`](../04-architecture.md)
- [`docs/05-roadmap.md`](../05-roadmap.md)
- [`docs/06-ai-behavior.md`](../06-ai-behavior.md)
- [`docs/07-security-and-privacy.md`](../07-security-and-privacy.md)
- [`docs/08-definition-of-done.md`](../08-definition-of-done.md)
- [ADR-001: Idioma y vocabulario canónico](0001-idioma-y-vocabulario-canonico.md)
- [Registro y plantilla de ADR](README.md)
