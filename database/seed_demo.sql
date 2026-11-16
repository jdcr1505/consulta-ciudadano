-- DATOS BASE Y DATOS FICTICIOS DE DEMOSTRACIÓN (no usar en producción)
-- Incluye catálogos, roles, permisos, fuente SIMULADA de Defensa y ciudadanos ficticios.
-- NO crea el administrador (requiere hash de contraseña): use 'npm run db:seed' en backend/.
SET client_encoding = 'UTF8';
--
-- PostgreSQL database dump
--

\restrict vKahvRLzPRFpqCaDSaX7sz0QGshelUPykcsE4OoxAepygGxkxipoVx49dGipPU8

-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)


--
-- Data for Name: ciudadano; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ciudadano (id, identificacion, nombres, apellidos, fecha_nacimiento, lugar_nacimiento, fecha_expedicion, lugar_expedicion, rh, grupo_sanguineo, estatura_cm, estado_judicial, activo, creado_por, creado_en, actualizado_en) VALUES (1, '52000111', 'Ana María', 'Rojas Pineda', '1985-03-12', 'Bogotá D.C.', '2003-04-20', 'Bogotá D.C.', 'POSITIVO', 'O', 163, 'NO_REQUERIDO', true, NULL, '2026-10-30 04:54:25.362+00', '2026-10-30 04:54:25.362+00');
INSERT INTO public.ciudadano (id, identificacion, nombres, apellidos, fecha_nacimiento, lugar_nacimiento, fecha_expedicion, lugar_expedicion, rh, grupo_sanguineo, estatura_cm, estado_judicial, activo, creado_por, creado_en, actualizado_en) VALUES (2, '79123456', 'Jorge Enrique', 'Castaño Lara', '1979-11-02', 'Medellín', '1997-12-10', 'Medellín', 'POSITIVO', 'A', 175, 'REQUERIDO', true, NULL, '2026-10-30 04:54:25.375+00', '2026-10-30 04:54:25.375+00');
INSERT INTO public.ciudadano (id, identificacion, nombres, apellidos, fecha_nacimiento, lugar_nacimiento, fecha_expedicion, lugar_expedicion, rh, grupo_sanguineo, estatura_cm, estado_judicial, activo, creado_por, creado_en, actualizado_en) VALUES (3, '1012345678', 'Valentina', 'Cruz Moreno', '1998-07-25', 'Cali', '2016-08-30', 'Cali', 'NEGATIVO', 'O', 168, 'NO_REQUERIDO', true, NULL, '2026-10-30 04:54:25.383+00', '2026-10-30 04:54:25.383+00');
INSERT INTO public.ciudadano (id, identificacion, nombres, apellidos, fecha_nacimiento, lugar_nacimiento, fecha_expedicion, lugar_expedicion, rh, grupo_sanguineo, estatura_cm, estado_judicial, activo, creado_por, creado_en, actualizado_en) VALUES (4, '80987654', 'Andrés Felipe', 'Gómez Ríos', '1982-01-18', 'Barranquilla', '2000-02-14', 'Barranquilla', 'POSITIVO', 'B', 180, 'REQUERIDO', true, NULL, '2026-10-30 04:54:25.393+00', '2026-10-30 04:54:25.393+00');
INSERT INTO public.ciudadano (id, identificacion, nombres, apellidos, fecha_nacimiento, lugar_nacimiento, fecha_expedicion, lugar_expedicion, rh, grupo_sanguineo, estatura_cm, estado_judicial, activo, creado_por, creado_en, actualizado_en) VALUES (5, '00123456', 'Marta Lucía', 'Herrera Soto', '1960-09-05', 'Bucaramanga', '1978-10-11', 'Bucaramanga', 'NEGATIVO', 'A', 158, 'NO_REQUERIDO', true, NULL, '2026-10-30 04:54:25.404+00', '2026-10-30 04:54:25.404+00');
INSERT INTO public.ciudadano (id, identificacion, nombres, apellidos, fecha_nacimiento, lugar_nacimiento, fecha_expedicion, lugar_expedicion, rh, grupo_sanguineo, estatura_cm, estado_judicial, activo, creado_por, creado_en, actualizado_en) VALUES (6, '1098765432', 'Santiago', 'Peña Quintero', '2001-05-30', 'Cartagena', '2019-06-12', 'Cartagena', 'POSITIVO', 'AB', 177, 'NO_REQUERIDO', true, NULL, '2026-10-30 04:54:25.428+00', '2026-10-30 04:54:25.428+00');
INSERT INTO public.ciudadano (id, identificacion, nombres, apellidos, fecha_nacimiento, lugar_nacimiento, fecha_expedicion, lugar_expedicion, rh, grupo_sanguineo, estatura_cm, estado_judicial, activo, creado_por, creado_en, actualizado_en) VALUES (7, '41555666', 'Rosa Elvira', 'Díaz Camacho', '1955-12-20', 'Tunja', '1974-01-15', 'Tunja', 'POSITIVO', 'O', 154, 'NO_REQUERIDO', true, NULL, '2026-10-30 04:54:25.449+00', '2026-10-30 04:54:25.449+00');
INSERT INTO public.ciudadano (id, identificacion, nombres, apellidos, fecha_nacimiento, lugar_nacimiento, fecha_expedicion, lugar_expedicion, rh, grupo_sanguineo, estatura_cm, estado_judicial, activo, creado_por, creado_en, actualizado_en) VALUES (8, '1022334455', 'Camilo Esteban', 'Ruiz Vega', '1993-04-08', 'Pereira', '2011-05-02', 'Pereira', 'POSITIVO', 'B', 172, 'REQUERIDO', true, NULL, '2026-10-30 04:54:25.46+00', '2026-10-30 04:54:25.46+00');


--
-- Data for Name: fuerza_publica; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.fuerza_publica (id, nombre) VALUES (1, 'Policía');
INSERT INTO public.fuerza_publica (id, nombre) VALUES (2, 'Ejército');
INSERT INTO public.fuerza_publica (id, nombre) VALUES (3, 'Armada');
INSERT INTO public.fuerza_publica (id, nombre) VALUES (4, 'Fuerza Aérea');


--
-- Data for Name: opcion; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.opcion (id, codigo, nombre) VALUES (1, 'solicitudes', 'Solicitudes de acceso');
INSERT INTO public.opcion (id, codigo, nombre) VALUES (2, 'usuarios', 'Usuarios');
INSERT INTO public.opcion (id, codigo, nombre) VALUES (3, 'roles', 'Roles y permisos');
INSERT INTO public.opcion (id, codigo, nombre) VALUES (4, 'ciudadanos', 'Ciudadanos');
INSERT INTO public.opcion (id, codigo, nombre) VALUES (5, 'consultas', 'Consultas');
INSERT INTO public.opcion (id, codigo, nombre) VALUES (6, 'novedades', 'Novedades');
INSERT INTO public.opcion (id, codigo, nombre) VALUES (7, 'reportes', 'Reportes');


--
-- Data for Name: permiso; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (1, 1, 'leer', 'solicitudes:leer');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (2, 1, 'resolver', 'solicitudes:resolver');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (3, 2, 'leer', 'usuarios:leer');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (4, 2, 'crear', 'usuarios:crear');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (5, 2, 'editar', 'usuarios:editar');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (6, 3, 'leer', 'roles:leer');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (7, 3, 'crear', 'roles:crear');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (8, 3, 'editar', 'roles:editar');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (9, 3, 'eliminar', 'roles:eliminar');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (10, 4, 'leer', 'ciudadanos:leer');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (11, 4, 'crear', 'ciudadanos:crear');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (12, 4, 'editar', 'ciudadanos:editar');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (13, 5, 'crear', 'consultas:crear');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (14, 5, 'leer', 'consultas:leer');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (15, 5, 'leer_todas', 'consultas:leer_todas');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (16, 6, 'crear', 'novedades:crear');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (17, 6, 'leer_propias', 'novedades:leer_propias');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (18, 6, 'gestionar', 'novedades:gestionar');
INSERT INTO public.permiso (id, opcion_id, accion, codigo) VALUES (19, 7, 'leer', 'reportes:leer');


--
-- Data for Name: rango; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (1, 1, 'Patrullero');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (2, 1, 'Subintendente');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (3, 1, 'Intendente');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (4, 1, 'Intendente Jefe');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (5, 1, 'Subcomisario');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (6, 1, 'Comisario');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (7, 1, 'Subteniente');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (8, 1, 'Teniente');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (9, 1, 'Capitán');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (10, 1, 'Mayor');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (11, 1, 'Teniente Coronel');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (12, 1, 'Coronel');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (13, 1, 'Brigadier General');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (14, 1, 'Mayor General');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (15, 1, 'General');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (16, 2, 'Soldado Profesional');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (17, 2, 'Cabo Tercero');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (18, 2, 'Cabo Segundo');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (19, 2, 'Cabo Primero');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (20, 2, 'Sargento Viceprimero');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (21, 2, 'Sargento Primero');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (22, 2, 'Sargento Mayor');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (23, 2, 'Subteniente');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (24, 2, 'Teniente');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (25, 2, 'Capitán');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (26, 2, 'Mayor');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (27, 2, 'Teniente Coronel');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (28, 2, 'Coronel');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (29, 2, 'Brigadier General');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (30, 2, 'Mayor General');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (31, 2, 'General');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (32, 3, 'Marinero Profesional');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (33, 3, 'Cabo Tercero');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (34, 3, 'Cabo Segundo');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (35, 3, 'Cabo Primero');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (36, 3, 'Sargento Viceprimero');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (37, 3, 'Sargento Primero');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (38, 3, 'Sargento Mayor');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (39, 3, 'Teniente de Corbeta');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (40, 3, 'Teniente de Fragata');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (41, 3, 'Teniente de Navío');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (42, 3, 'Capitán de Corbeta');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (43, 3, 'Capitán de Fragata');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (44, 3, 'Capitán de Navío');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (45, 3, 'Contralmirante');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (46, 3, 'Vicealmirante');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (47, 3, 'Almirante');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (48, 4, 'Soldado Profesional');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (49, 4, 'Técnico Cuarto');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (50, 4, 'Técnico Tercero');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (51, 4, 'Técnico Segundo');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (52, 4, 'Técnico Primero');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (53, 4, 'Técnico Jefe');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (54, 4, 'Subteniente');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (55, 4, 'Teniente');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (56, 4, 'Capitán');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (57, 4, 'Mayor');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (58, 4, 'Teniente Coronel');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (59, 4, 'Coronel');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (60, 4, 'Brigadier General');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (61, 4, 'Mayor General');
INSERT INTO public.rango (id, fuerza_publica_id, nombre) VALUES (62, 4, 'General');


--
-- Data for Name: rol; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.rol (id, nombre, descripcion, es_base) VALUES (1, 'ADMINISTRADOR', 'Administra el sistema por la web', true);
INSERT INTO public.rol (id, nombre, descripcion, es_base) VALUES (2, 'FUNCIONARIO', 'Personal de la fuerza pública (app móvil)', true);


--
-- Data for Name: rol_permiso; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 1);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 2);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 3);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 4);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 5);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 6);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 7);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 8);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 9);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 10);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 11);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 12);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 13);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 14);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 15);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 16);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 17);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 18);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (1, 19);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (2, 13);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (2, 14);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (2, 16);
INSERT INTO public.rol_permiso (rol_id, permiso_id) VALUES (2, 17);


--
-- Data for Name: sim_defensa; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.sim_defensa (identificacion, nombres, apellidos, fuerza, rango, id_fuerza) VALUES ('1020304050', 'Carlos Andrés', 'Vargas Mejía', 'Policía', 'Intendente', 'PN-48213');
INSERT INTO public.sim_defensa (identificacion, nombres, apellidos, fuerza, rango, id_fuerza) VALUES ('1030405060', 'Laura Sofía', 'Ramírez Duque', 'Ejército', 'Capitán', 'EJ-77120');
INSERT INTO public.sim_defensa (identificacion, nombres, apellidos, fuerza, rango, id_fuerza) VALUES ('1040506070', 'Julián David', 'Torres Peña', 'Armada', 'Teniente de Corbeta', 'AR-30955');
INSERT INTO public.sim_defensa (identificacion, nombres, apellidos, fuerza, rango, id_fuerza) VALUES ('1050607080', 'Diana Marcela', 'Ortiz León', 'Fuerza Aérea', 'Teniente', 'FA-20418');
INSERT INTO public.sim_defensa (identificacion, nombres, apellidos, fuerza, rango, id_fuerza) VALUES ('1060708090', 'Héctor Fabio', 'Salazar Nieto', 'Policía', 'Patrullero', 'PN-59001');


--
-- Name: ciudadano_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ciudadano_id_seq', 8, true);


--
-- Name: fuerza_publica_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.fuerza_publica_id_seq', 4, true);


--
-- Name: opcion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.opcion_id_seq', 7, true);


--
-- Name: permiso_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.permiso_id_seq', 19, true);


--
-- Name: rango_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rango_id_seq', 62, true);


--
-- Name: rol_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rol_id_seq', 2, true);


--
-- PostgreSQL database dump complete
--

\unrestrict vKahvRLzPRFpqCaDSaX7sz0QGshelUPykcsE4OoxAepygGxkxipoVx49dGipPU8

