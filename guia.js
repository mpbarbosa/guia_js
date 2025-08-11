function renderHtmlCoords(
	latitude,
	longitude,
	altitude,
	precisao,
	precisaoAltitude,
) {
	var html = "";
	if (latitude) {
		html += `<p><strong>Latitude:</strong> ${latitude.toFixed(6)}<br>`;
	}
	if (longitude) {
		html += `<p><strong>Longitude:</strong> ${longitude.toFixed(6)}<br>`;
	}
	if (altitude) {
		html += `<strong>Altitude</strong>: ${altitude.toFixed(2)} metros<br>`;
	}
	if (precisao) {
		html += `<p><strong>Precisão:</strong> ±${Math.round(precisao)} metros</p>`;
	}
	if (precisaoAltitude) {
		html += `<p><strong>Precisão da altitude:</strong> ±${Math.round(precisaoAltitude)} metros</p>`;
	}

	html += ` <p><a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank">Ver no Google Maps</a> 
  <a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}">Ver no Google Street View</a></p> `;

	return html;
}

function checkGeolocation(element) {
	// Check if geolocation is supported by the browser
	if (!navigator.geolocation) {
		element.innerHTML =
			'<p class="error">Geolocation is not supported by your browser.</p>';
		return;
	}
}

function showCoords(
	element,
	latitude,
	longitude,
	altitude,
	precisao,
	precisaoAltitude,
) {
	// Display coordinates first
	element.innerHTML = renderHtmlCoords(
		latitude,
		longitude,
		altitude,
		precisao,
		precisaoAltitude,
	);
}

function getAddressType(address) {
	const addressClass = address.class;
	const addressType = address.type;
	var addressTypeDescr;

	console.log("addressClass: " + addressClass);
	console.log("addressType: " + addressType);
	console.log(address);
	if (addressClass == "place" && addressType == "house") {
		addressTypeDescr = "Residencial";
	} else if (addressClass == "shop" && addressType == "mall") {
		addressTypeDescr = "Shopping Center";
	} else {
		addressTypeDescr = "Não classificado";
	}
	return addressTypeDescr;
}

function renderAddress(data) {
	var addressTypeDescr;

	addressTypeDescr = getAddressType(data);

	var html = "";

	if (data.address) {
		html += `<p><strong>Tipo:</strong> ${addressTypeDescr}<br>`;
		html += "<p><strong>Address Details:</strong></p><ul>";
		for (const [key, value] of Object.entries(data.address)) {
			html += `<li><strong>${key}:</strong> ${value}</li>`;
		}
		html += "</ul>";

		html += ` <strong>Logradouro/Número:</strong> ${data.address.road}, ${data.address.house_number}<br>
    <strong>Bairro:</strong> ${data.address.suburb}<br>
    <strong>Município/Cidade:</strong> ${data.address.city}<br>
    ${data.address.municipality}<br>
    ${data.address.county}<br>
    <strong>UF:</strong> ${data.address.state}<br>
    <strong>Região:</strong> ${data.address.region}<br>
    <strong>CEP:</strong> ${data.address.postcode}<br>
    <strong>País:</strong> ${data.address.country}<br>
    <strong>Código do país:</strong> ${data.address.country_code}<br>
    <strong>Boundingbox</strong>: ${data.boundingbox} </p> `;

		html += `${JSON.stringify(data)}`;
	}

	return html;
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

function buildTextToSpeech(address) {
	var bairro = address.suburb;

	if (!bairro) {
		bairro = address.neibourhood;
	}
	const fBairro = bairro ? "Bairro " + bairro : "";
	return fBairro;
}
