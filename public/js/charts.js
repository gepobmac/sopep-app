let consumoChart;
let estoqueChart;
export function renderConsumoChart(ctx, dataset) {
    if (consumoChart)
        consumoChart.destroy();
    consumoChart = new window.Chart(ctx, {
        type: 'line',
        data: {
            labels: dataset.labels,
            datasets: [{ label: 'Consumo (unid)', data: dataset.data }]
        },
        options: { responsive: true }
    });
}
export function renderEstoqueChart(ctx, itens) {
    if (estoqueChart)
        estoqueChart.destroy();
    const labels = itens.slice(0, 8).map(i => i.nome);
    const estoque = itens.slice(0, 8).map(i => i.estoque);
    const min = itens.slice(0, 8).map(i => i.min);
    estoqueChart = new window.Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Estoque', data: estoque },
                { label: 'Mínimo', data: min }
            ]
        },
        options: { responsive: true }
    });
}
