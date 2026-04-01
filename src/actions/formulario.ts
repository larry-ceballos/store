import { chechkDB, insertDB, uploadFile } from "@/src/lib/supabase"
import { defineAction } from "astro:actions"
import { z } from "astro/zod"

export const formularioActions = {
    getForm: defineAction({
        input: z.object({
            search: z.string().optional().default(""),
            state: z.string().optional().default(""),
        }),
        handler: async (input) => {
            const { search, state } = input;
            return { search, state };
        }
    }),
    addCategory: defineAction({
        input: z.object({
            nombre: z.string().min(4),
        }),
        handler: async ({ nombre }) => await insertDB({ table: "tipo_producto", data: { nombre_tipo_producto: nombre } })
    }),
    addSupplier: defineAction({
        input: z.object({
            nombre: z.string().min(4),
        }),
        handler: async ({ nombre }) => await insertDB({ table: "proveedor", data: { nombre_proveedor: nombre } })
    }),
    checkProductDuplicates: defineAction({
        input: z.object({
            nombre: z.string().min(4),
            descripcion: z.string().min(4).max(200),
        }),
        handler: async ({ nombre, descripcion }) => {
            const nameMatch = await chechkDB({
                table: "producto",
                column: "nombre_producto",
                valueCompare: nombre
            })
            const descMatch = await chechkDB({
                table: "producto",
                column: "descripcion",
                valueCompare: descripcion
            })
            return {
                nombre: !!nameMatch,
                descripcion: !!descMatch,
            };
        }
    }),
    uploadImages: defineAction({
        accept: 'form',
        input: z.object({
            images: z.array(z.instanceof(File)),
            type: z.string().min(4),
            supplier: z.string().min(4),
            name: z.string().min(4),
        }),
        handler: async ({ images, type, supplier, name }) => await Promise.all(
            images.map(async (image) => {
                const url = await uploadFile({ file: image, supplier, name, type });
                return url;
            })
        )
    }),
    addProduct: defineAction({
        input: z.object({
            nombre: z.string().min(4),
            descripcion: z.string().min(4).max(200),
            precio: z.string().min(0),
            genero: z.string().min(1),
            categoria: z.string().min(1),
            proveedor: z.string().min(1),
            images: z.array(z.string()),
        }),
        handler: async ({ nombre, descripcion, precio, genero, categoria, proveedor, images }) => {
            const product = await insertDB({
                table: "producto",
                data: {
                    nombre_producto: nombre,
                    descripcion_producto: descripcion,
                    precio_producto: precio,
                    activo_producto: true,
                    id_genero: genero,
                    id_tipo_producto: categoria,
                    id_proveedor: proveedor,
                }
            })

            if (images && images.length > 0) {
                const imageInsertions = images.map(async (image, index) => {
                    return await insertDB({
                        table: "imagen_producto",
                        data: {
                            id_producto: product.id_producto,
                            url_imagen: image,
                            orden_imagen: index + 1,
                        }
                    })
                });
                return await Promise.all(imageInsertions);
            }
            return product;
        }
    }),
}