
import { catalogoActions } from "@/src/actions/catalogo";
import { formularioActions } from "@/src/actions/formulario";
import { sessionActions } from "@/src/actions/sesions";

export const server = {
    ...catalogoActions,
    ...formularioActions,
    ...sessionActions,
}