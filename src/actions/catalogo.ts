import { supabase } from "@/src/lib/supabase"
import { ActionError, defineAction } from "astro:actions"
import { z } from "astro/zod"

export const catalogoActions = {
    toggleProductStatus: defineAction({
        input: z.object({
            id_producto: z.number(),
            activo: z.boolean(),
        }),
        handler: async ({ id_producto, activo }, context) => {
            const accessToken = context.cookies.get("sb-access-token")?.value;
            const refreshToken = context.cookies.get("sb-refresh-token")?.value;

            if (!accessToken || !refreshToken) {
                throw new ActionError({
                    code: "UNAUTHORIZED",
                    message: "Debes iniciar sesión para realizar esta acción.",
                });
            }

            const { data: sessionData } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });

            const userRole =
                sessionData.user?.app_metadata?.role ||
                sessionData.user?.user_metadata?.role ||
                "user";

            if (userRole !== "editor") {
                throw new ActionError({
                    code: "FORBIDDEN",
                    message: "No tienes permisos para cambiar el estado de los productos.",
                });
            }

            const { data, error } = await supabase
                .from("producto")
                .update({ activo_producto: activo })
                .eq("id_producto", id_producto)
                .select()
                .single();

            if (error) throw error;
            return data;
        }
    })
}