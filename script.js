let originalRainfallData = [];

function applyCumulativeDays(days) {
    if (!days || days < 1) {
        alert("Please enter a valid number of days for cumulative rainfall.");
        return;
    }

    const newRainfallData = [];

    for (let row = 0; row < rainfallData.length - days + 1; row++) {
        const cumulativeRow = Array(rainfallData[0].length).fill(0);

        for (let d = 0; d < days; d++) {
            for (let col = 0; col < rainfallData[0].length; col++) {
                cumulativeRow[col] += rainfallData[row + d][col];
            }
        }

        newRainfallData.push(cumulativeRow);
    }

    rainfallData = newRainfallData;
    alert(`Cumulative rainfall over ${days} days applied.`);
}

function get90thPercentile(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(0.9 * sorted.length);
    return sorted[index];
}

function resetRainfallData() {
    if (originalRainfallData.length > 0) {
        rainfallData = JSON.parse(JSON.stringify(originalRainfallData));
        alert("Rainfall data has been reset to original.");
    }
}

function loadExcelFromServer() {
    fetch('data/excel_file.xlsx')
        .then(response => response.arrayBuffer())
        .then(data => {
            const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            latitudes = jsonData[0].slice(1);
            longitudes = jsonData.slice(1).map(row => row[0]);
            rainfallData = jsonData.slice(1).map(row => row.slice(1));
            originalRainfallData = JSON.parse(JSON.stringify(rainfallData));
        })
        .catch(error => console.error('Error loading Excel file:', error));
}

document.addEventListener("DOMContentLoaded", function () {
    loadExcelFromServer();
});

let rainfallData = [];
let latitudes = [];
let longitudes = [];

function findClosestIndex(array, value) {
    return array.reduce((prev, curr) => Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
}

function calculate() {
    const lat = parseFloat(document.getElementById('latitude').value);
    const lon = parseFloat(document.getElementById('longitude').value);
    const area = parseFloat(document.getElementById('area').value);

    if (!lat || !lon || !area) {
        alert("Please enter valid Latitude, Longitude, and Rooftop Area.");
        return;
    }

    const closestLat = findClosestIndex(latitudes, lat);
    const closestLon = findClosestIndex(longitudes, lon);

    const latIndex = latitudes.indexOf(closestLat);
    const lonIndex = longitudes.indexOf(closestLon);

    const columnData = rainfallData.map(row => row[latIndex]);
    const percentile90 = get90thPercentile(columnData);

    const Q = (0.9 * area * percentile90) / 1000;
    const Qliters = Q * 1000;

    document.getElementById('outputQ').innerText = `Total Harvested Water : ${Q.toFixed(4)} cubic meters\n(${Qliters.toFixed(0)} liters)`;
    document.getElementById('intensity').innerText = `Rainfall Intensity Used : ${percentile90.toFixed(2)} mm`;
    document.getElementById('tankSelection').style.display = 'block';
}

function toggleTankInputs() {
    const shape = document.getElementById('tankShape').value;
    document.getElementById('cylinderInputs').style.display = shape === 'cylinder' ? 'block' : 'none';
    document.getElementById('rectInputs').style.display = shape === 'rectangle' ? 'block' : 'none';
}

function calculateTank() {
    const Q = parseFloat(document.getElementById('outputQ').innerText.split(': ')[1]);
    const shape = document.getElementById('tankShape').value;
    let dimensions = '';

    if (shape === 'cylinder') {
        let radius = parseFloat(document.getElementById('cylinderRadius').value) || 0;
        let height = parseFloat(document.getElementById('cylinderHeight').value) || 0;

        if (radius && !height) {
            height = Q / (Math.PI * Math.pow(radius, 2));
        } else if (height && !radius) {
            radius = Math.sqrt(Q / (Math.PI * height));
        }
        dimensions = `Radius: ${radius.toFixed(2)} meters, Height: ${height.toFixed(2)} meters`;
    } else {
        let height = parseFloat(document.getElementById('rectHeight').value) || 0;
        let length = parseFloat(document.getElementById('rectLength').value) || 0;
        let breadth = 0;

        if (length && !height) {
            breadth = length / 2;
            height = Q / (length * breadth);
        } else if (height && !length) {
            breadth = Math.sqrt(Q / (2 * height));
            length = 2 * breadth;
        }
        dimensions = `Length: ${length.toFixed(2)} meters, Breadth: ${breadth.toFixed(2)} meters, Height: ${height.toFixed(2)} meters`;
    }

    document.getElementById('outputDimensions').innerText = dimensions;
}

function calculateCost() {
    const shape = document.getElementById('tankShape').value;
    const material = document.getElementById('tankMaterial').value;
    let Q;

    const userQInput = document.getElementById('userQLiters');
    if (userQInput && userQInput.value) {
        Q = parseFloat(userQInput.value);
    } else {
        Q = parseFloat(document.getElementById('outputQ').innerText.split(': ')[1]) * 1000;
    }

    let totalCost = 0;

    if (material === 'concrete') {
        const excavationCost = 150 * (Q / 1000);
        const brickworkCost = 1400 * (Q / 1000);
        const concreteCost = 4700 * (Q / 1000);
        totalCost = excavationCost + brickworkCost + concreteCost;
    } else if (material === 'plastic') {
        const minRate = 2.0;
        const maxRate = 3.5;
        totalCost = Q * ((minRate + maxRate) / 2);
    } else if (material === 'steel') {
        totalCost = 0.61 * Q + 9392.27;
    }

    document.getElementById('outputCost').innerText = `Estimated Cost: ₹${totalCost.toFixed(2)}`;
}

function calculateRecharge() {
    const outputQText = document.getElementById('outputQ').innerText;
    const match = outputQText.match(/\((\d+(?:\.\d+)?) liters\)/);
    const Qliters = match ? parseFloat(match[1]) : NaN;

    const familyMembers = parseInt(document.getElementById('familyMembers').value);
    const days = parseInt(document.getElementById('usageDays').value);

    if (isNaN(Qliters) || isNaN(familyMembers) || isNaN(days) || familyMembers <= 0 || days <= 0) {
        alert("Please enter valid number of family members and days.");
        return;
    }

    const usagePerDay = 150;
    const totalUsage = familyMembers * usagePerDay * days;
    const recharge = Qliters - totalUsage;

    document.getElementById('rechargeOutput').innerText = `Estimated Groundwater Recharge: ${recharge > 0 ? recharge.toFixed(0) : 0} liters`;
}
