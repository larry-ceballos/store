import { supabase } from "@/src/lib/supabase";
import { defineAction } from "astro:actions";
import { z } from "astro/zod";

export const sessionActions = {
    login: defineAction({
        accept: "form",
        input: z.object({
            email: z.string().min(1, "El campo no puede estar vacío"),
            password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
            remember: z.string().optional(),
        }),
        handler: async (input, context) => {
            const { email: inputEmail, password, remember } = input;
            
            let email = inputEmail;
            
            if (!inputEmail.includes("@")) {
                const { data: usersData, error: usersError } = await supabase.auth.listUsers();
                
                if (usersError) {
                    return {
                        success: false,
                        error: {
                            code: "invalid_credentials",
                            message: "Usuario o contraseña incorrectos."
                        }
                    };
                }
                
                const foundUser = usersData.users.find(
                    u => u.user_metadata?.displayName?.toLowerCase() === inputEmail.toLowerCase()
                );
                
                if (!foundUser) {
                    return {
                        success: false,
                        error: {
                            code: "invalid_credentials",
                            message: "Usuario o contraseña incorrectos."
                        }
                    };
                }
                
                email = foundUser.email || "";
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                let message = "Error al iniciar sesión. Inténtalo de nuevo.";
                if (error.code === "invalid_credentials") {
                    message = "El correo o la contraseña son incorrectos.";
                } else if (error.code === "email_not_confirmed") {
                    message = "Por favor, confirma tu correo electrónico.";
                }

                return {
                    success: false,
                    error: {
                        code: error.code,
                        message: message
                    }
                };
            }

            const DAY = 60 * 60 * 24;
            const timeRemember = remember === "on" ? DAY * 30 : DAY;

            if (data.session) {
                context.cookies.set("sb-access-token", data.session.access_token, {
                    path: "/",
                    maxAge: timeRemember,
                });
                context.cookies.set("sb-refresh-token", data.session.refresh_token, {
                    path: "/",
                    maxAge: timeRemember,
                });
            }

            return {
                success: true,
            };
        },
    }),
    closeSession: defineAction({
        handler: async (_, context) => {
            const { error } = await supabase.auth.signOut();
            if (error) console.error("Error signing out:", error);

            context.cookies.delete("sb-access-token", { path: "/" });
            context.cookies.delete("sb-refresh-token", { path: "/" });

            return {
                success: true
            };
        },
    }),
    register: defineAction({
        accept: "form",
        input: z.object({
            email: z.email("Correo electrónico inválido"),
            username: z.string().min(3, "El usuario debe tener al menos 3 caracteres").max(20, "El usuario debe tener máximo 20 caracteres").regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y guiones bajos"),
            password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
            role: z.enum(["editor", "user"]),
        }),
        handler: async (input, context) => {
            const { email, username, password, role } = input;

            const accessToken = context.cookies.get("sb-access-token")?.value;

            if (!accessToken) {
                return { success: false, error: { message: "No autorizado. Sesión no encontrada." } };
            }

            const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

            if (authError || !user) {
                return { success: false, error: { message: "Sesión inválida o expirada." } };
            }

            const currentUserRole = user.app_metadata?.role || user.user_metadata?.role || "user";
            if (currentUserRole !== "editor") {
                return { success: false, error: { message: "No tienes permisos para realizar esta acción." } };
            }

            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email,
                password,
                app_metadata: { role },
                user_metadata: { displayName: username },
                email_confirm: true,
            });

            if (createError) {
                if (createError.message.includes("already been registered")) {
                    return { success: false, error: { message: "El correo electrónico ya está registrado." } };
                }
                return {
                    success: false,
                    error: {
                        message: createError.message || "Error al crear la cuenta."
                    }
                };
            }

            return {
                success: true,
                message: `Cuenta de ${role} creada exitosamente para ${email}.`
            };
        },
    }),
    sentEmailForResetPassword: defineAction({
        input: z.object({
            email: z.string().email("Correo electrónico inválido"),
        }),
        handler: async (input, context) => {
            const { email } = input;
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${context.url.origin}/`,
            });
            if (error) {
                return {
                    success: false,
                    error: { message: error.message }
                };
            }
            return {
                success: true,
                message: "Correo electrónico enviado exitosamente."
            };
        },
    }),
    updatePassword: defineAction({
        input: z.object({
            password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
        }),
        handler: async (input, context) => {
            const { password } = input;
            const accessToken = context.cookies.get("sb-access-token")?.value;
            const refreshToken = context.cookies.get("sb-refresh-token")?.value;

            if (!accessToken || !refreshToken) {
                return {
                    success: false,
                    error: { message: "Sesión de recuperación no encontrada o expirada." }
                };
            }

            await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });

            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                return {
                    success: false,
                    error: { message: error.message }
                };
            }

            return {
                success: true,
                message: "Contraseña actualizada exitosamente."
            };
        },
    }),
    updateProfile: defineAction({
        input: z.object({
            displayName: z.string().min(3, "El usuario debe tener al menos 3 caracteres").max(20, "El usuario debe tener máximo 20 caracteres").regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y guiones bajos"),
        }),
        handler: async (input, context) => {
            const { displayName } = input;
            const accessToken = context.cookies.get("sb-access-token")?.value;
            const refreshToken = context.cookies.get("sb-refresh-token")?.value;

            if (!accessToken || !refreshToken) {
                return {
                    success: false,
                    error: { message: "Sesión no encontrada o expirada." }
                };
            }

            await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });

            const { error } = await supabase.auth.updateUser({
                user_metadata: { displayName }
            });

            if (error) {
                return {
                    success: false,
                    error: { message: error.message }
                };
            }

            return {
                success: true,
                message: "Perfil actualizado exitosamente."
            };
        },
    }),
    updateRole: defineAction({
        input: z.object({
            role: z.enum(["editor", "user"]),
        }),
        handler: async (input, context) => {
            const { role } = input;
            const accessToken = context.cookies.get("sb-access-token")?.value;
            const refreshToken = context.cookies.get("sb-refresh-token")?.value;

            if (!accessToken || !refreshToken) {
                return {
                    success: false,
                    error: { message: "Sesión no encontrada o expirada." }
                };
            }

            await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });

            const { error } = await supabase.auth.updateUser({
                app_metadata: { role }
            });

            if (error) {
                return {
                    success: false,
                    error: { message: error.message }
                };
            }

            return {
                success: true,
                message: "Rol actualizado exitosamente."
            };
        },
    }),
};