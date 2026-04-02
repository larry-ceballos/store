import { defineAction } from "astro:actions"
import { z } from "astro/zod";
export const serverActions = {
    sendMessage: defineAction({
        input: z.object({
            text: z.string(),
            files: z.array(z.string())
        }),
        handler: async ({ text, files }) => {
            try {
                const res = await fetch("http://localhost:1234/mensajes", {
                    method: "POST",
                    body: JSON.stringify({ message:text, images:files }),
                    headers: {
                        "Content-Type": "application/json",
                        "x-user-id": "144ad33d-d29a-43ac-8b43-c2b348e34649",
                        "x-product-id": "001"
                    },
                })
                const { message } = await res.json()

                if(!res.ok)
                    return { success: false ,message :message || "Error en la solicitud al servidor" }

                return { success: true, message: message }
                    
            } catch (error) {   
                return { success: false ,message:"Error en la solicitud al servidor"}
            }
        }
    })    
}