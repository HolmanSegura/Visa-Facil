-- ============================================================
--  MIGRACIÓN 001 — Activar contraseñas de usuarios
--  Ejecutar UNA SOLA VEZ en phpMyAdmin o MySQL CLI.
--
--  Contraseña inicial para TODOS los usuarios: Oblicua2026!
--  El hash se actualiza automáticamente al primer login correcto.
--
--  Después de hacer deploy, pedir a cada usuario que cambie
--  su contraseña desde Configuración (funcionalidad futura).
-- ============================================================

USE visa_facil;

-- Hash bcrypt de "Oblicua2026!" con cost=12
-- Generado: 2026-06-01
SET @hash_default = '$2y$12$CkSlYXwbnaHIbrMPwgxAfusudjlE/avG6ssWFFafCi0X7b8EnWK9W';

UPDATE usuarios
SET password_hash = @hash_default
WHERE password_hash = ''
   OR password_hash LIKE '$2y$12$placeholder%';

-- Verificar resultado
SELECT id, nombre, email, rol,
       CASE WHEN password_hash LIKE '$2y$12$placeholder%' OR password_hash = ''
            THEN 'PENDIENTE'
            ELSE 'OK'
       END AS estado_password
FROM usuarios
ORDER BY id;
