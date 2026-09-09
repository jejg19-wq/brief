# Guía privada de consulta

Página estática con contenido cifrado AES-256-GCM y clave derivada con PBKDF2-SHA256 (600.000 iteraciones). No incluir claves, documentos sin cifrar ni identificadores médicos en este directorio. Requiere HTTPS para Web Crypto. Sin analítica ni solicitudes externas para desbloquear.

La clave se distribuye por separado. Quien la tenga puede descargar el contenido. No es un portal clínico ni dispone de cuentas, revocación individual o auditoría. Rotar la clave requiere volver a cifrar; no revoca copias previas.
