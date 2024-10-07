const searchInput = document.getElementById('search');
searchInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        event.preventDefault(); // Evita o comportamento padrão do Enter (se necessário)
        executarBusca(); // Chama a função desejada
    }
});

function executarBusca() {
    let query = searchInput.value.trim(); // Usar let para permitir reatribuição
    query = query.toLowerCase(); // Convertendo a string para minúsculas
    if (query) {
        window.location.href = '/musica/' + encodeURIComponent(query);
    }
}
