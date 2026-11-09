-- Avisos de seguridad de Supabase al crear el proyecto real (9 nov 2026).
-- Las funciones de los triggers no se llaman desde la página: nadie las puede
-- ejecutar por la API. Los triggers siguen funcionando igual.
revoke execute on function public.crear_perfil() from public, anon, authenticated;
revoke execute on function public.actualizar_rol() from public, anon, authenticated;
revoke execute on function public.antes_de_guardar_cliente() from public, anon, authenticated;
revoke execute on function public.antes_de_guardar_compra() from public, anon, authenticated;
revoke execute on function public.despues_de_guardar_compra() from public, anon, authenticated;
revoke execute on function public.antes_de_guardar_canje() from public, anon, authenticated;

-- Sin sesión no hace falta saber el rol.
revoke execute on function public.es_admin() from public, anon;
revoke execute on function public.es_personal() from public, anon;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.es_personal() to authenticated;

alter function public.normalizar_telefono(text) set search_path = public;
