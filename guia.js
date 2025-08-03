function showCoords(element, latitude, longitude, precisao) {
	// Display coordinates first
	element.innerHTML = `
                        <p><strong>Latitude:</strong> ${latitude.toFixed(6)}<br>
                        <strong>Longitude:</strong> ${longitude.toFixed(6)}<br>
                        <strong>Precisão:</strong> ±${Math.round(accuracy)} metros</p>
                        <p><a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank">Ver no Google Maps</a></p>
                        `;
}

function getLocation() {
	console.log("início getLocation()...");
	const myLocation = document.getElementById("myLocation");
	myLocation.innerHTML = "Carregando a localização atual...";

	// Check if geolocation is supported by the browser
	if (!navigator.geolocation) {
		locationResult.innerHTML =
			'<p class="error">Geolocalização não é implementada pelo seu navegador.</p>';
	}

	// Get current position
	navigator.geolocation.getCurrentPosition(async (position) => {
		// Success callback
		const latitude = position.coords.latitude;
		const longitude = position.coords.longitude;
		const precisao = position.coords.accuracy; // in meters

		// Store coordinates
		currentCoords = { latitude, longitude };

		showCoords(element, latitude, longitude, precisao);
	});
}
