he revisado la extension y tengo las siguientes observaciones:

- eliminar conversaciones no funciona y el eliminarlas de la UI tambien se deben eliminar del almacenamiento o base de datos que se este usando y tambien se debe de eliminar esa sesion de copilot para no dejar archivos residuales del usuario
- cammbiar de idioma no funciona, si se cambia en el settings pero no se aplica a la extension asi que todo sigue estan en el idioma por defecto
- el tema no cambia al cambiarlo en settings
- seleccione idioma español en los settings de la extension y ese no fue tomado para enviarlo al prompt para que ese sea el idioma objetivo
- cuando abro un chat ya existente no se hace llamado a /sessions/:id/resume lo cual genera un error.
- verifica que todos los endpoints del back son llamados en el front y tiene logica sus respectivos llamados
- añade con una variable de entorno la posibilidad de tener una observavilidad de todo el back de tal forma que pueda ver todo lo que entra y sale de cada peticion