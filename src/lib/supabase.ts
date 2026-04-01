import { createClient, } from "@supabase/supabase-js";

export const supabase = createClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_KEY,
    {
        auth: {
            flowType: "pkce",
        },
    }
);

export const uploadFile = async ({ file, supplier, type, name, bucket = "store" }: { file: File, supplier: string, type: string, name: string, bucket?: string }) => {
    const date = new Date()
    const year = date.toLocaleString('es-ES', { year: 'numeric' });
    const month = date.toLocaleString('es-ES', { month: 'long' });
    const datePath = `${month}-${year}`
    const path = `${supplier}/${datePath}/${type}/${name}/${file.name}`

    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: true
    })

    let res = ""
    if (error) {
        console.error("Error al subir el archivo -> " + error)
    } else {
        const { data: dataUrl } = await supabase.storage.from(bucket).createSignedUrl(data.path, 60 * 60 * 24 * 30)
        res = dataUrl?.signedUrl || ""
    }
    return res
}

export const chechkDB = async ({ table, column, valueCompare }: { table: string, column: string, valueCompare: string }) => {
    const { data, error } = await supabase
        .from(table)
        .select(column)
        .eq(column, valueCompare)
        .maybeSingle()
    return data
}

export const insertDB = async ({ table, data }: { table: string, data: any }) => {
    const { data: result, error } = await supabase.from(table).insert(data).select().single();
    if (error) throw error;
    return result;
}

export const fetchDB = async ({ table, columns }: { table: string, columns: string }) => {
    const { data, error } = await supabase
        .from(table)
        .select(columns);
    if (error) console.error(error);
    return data as unknown;
}

export const fetchProductsDB = async ({ search, state, gender, category }: { search: string, state: string, gender: string, category: string }) => {
    let res = supabase
        .from("producto")
        .select(
            "id_producto,id_tipo_producto,precio_producto,nombre_producto,descripcion_producto,id_proveedor,activo_producto,id_genero",
        );
    if (search) {
        res = res.ilike("nombre_producto", `%${search}%`);
    }
    if (state === "activos") {
        res = res.eq("activo_producto", true);
    } else if (state === "inactivos") {
        res = res.eq("activo_producto", false);
    }
    if (gender !== "todos") {
        res = res.eq("id_genero", Number(gender));
    }
    if (category !== "todas") {
        res = res.eq("id_tipo_producto", Number(category));
    }
    return await res;
};