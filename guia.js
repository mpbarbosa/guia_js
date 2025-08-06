function renderCoords(latitude, longitude, precisao) {
	return ` <p><strong>Latitude:</strong> ${latitude.toFixed(6)}<br>
   <strong>Longitude:</strong> ${longitude.toFixed(6)}<br>
   <strong>Precisão:</strong> ±${Math.round(precisao)} metros</p>
  <p><a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank">Ver no Google Maps</a> 
  <a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}">Ver no Google Street View</a></p>
               `;
}

function checkGeolocation(element) {
	// Check if geolocation is supported by the browser
	if (!navigator.geolocation) {
		element.innerHTML =
			'<p class="error">Geolocation is not supported by your browser.</p>';
		return;
	}
}

function showCoords(element, latitude, longitude, precisao) {
	// Display coordinates first
	element.innerHTML = renderCoords(latitude, longitude, precisao);
}

function renderAddress(address) {
	const addressClass = address.class;
	const addressType = address.type;
	var addressTypeDescr;

	if (addressClass == "place" && addressType == "house") {
		addressTypeDescr = "Residencial";
	} else if (addressClass == "shop" && addressType == "mall") {
		addressTypeDescr = "Shopping Center";
	} else {
		addressTypeDescr = "Não classificado";
	}

	return `<p><strong>Tipo:</strong> ${addressTypeDescr}<br>
    <strong>Logradouro/Número:</strong> ${address.address.road}, ${address.address.house_number}<br>
    <strong>Bairro:</strong> ${address.address.suburb}<br>
    <strong>Município/Cidade:</strong> ${address.address.city}<br>
    ${address.address.municipality}<br>
    ${address.address.county}<br>
    <strong>UF:</strong> ${address.address.state}<br>
    <strong>Região:</strong> ${address.address.region}<br>
    <strong>CEP:</strong> ${address.address.postcode}<br>
    <strong>País:</strong> ${address.address.country}<br>
    <strong>Código do país:</strong> ${address.address.country_code}<br>
    <strong>Boundingbox</strong>: ${address.boundingbox} </p>
    ${JSON.stringify(address)}`;
}

function getLocation() {
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

		//TODO: qual o valor da variável element?
		showCoords(element, latitude, longitude, precisao);
	});
}
