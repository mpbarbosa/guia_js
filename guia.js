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
			'<p class="error">O seu navegador não tem a funcionalidade de geolocalização.</p>';
	} else {
		element.innerHTML +=
			"<p>O seu navegador tem a funcionalidade de geolocalização.</p>";
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

function getSingleLocationUpdate() {
	locationResult.innerHTML =
		'<p class="loading">Buscando a sua localização...</p>';

	getCurrentLocation()
		.then((position) => {
			displayPosition(position);
		})
		.then((position) => {
			console.log("segundo - position:", position);
		})
		.catch((error) => {
			displayError(error);
		});
}

function startTrecking() {
	// Set up event listeners
	speakBtn.addEventListener("click", speak);
	pauseBtn.addEventListener("click", pauseSpeech);
	resumeBtn.addEventListener("click", resumeSpeech);
	stopBtn.addEventListener("click", stopSpeech);
	languageSelect.addEventListener("change", loadVoices);
	rateInput.addEventListener("input", updateRate);
	pitchInput.addEventListener("input", updatePitch);

	/*
  Get current location. Do an initial check to see
  if the user has granted location permissions. Do an immediate
  update.
  */

	getSingleLocationUpdate();

	// Then set up periodic updates
	trackingInterval = setInterval(() => {
		getCurrentLocation()
			.then((position) => {
				displayLocation(position);
			})
			.catch((error) => {
				displayError(error);
				// Stop the tracking interval
				stopTracking();
			});
	}, 5000); // Update every 5 seconds
}

function getCurrentLocation() {
	return new Promise(async function (resolve, reject) {
		checkGeolocation(locationResult);

		if (findRestaurantsBtn) {
			findRestaurantsBtn.disabled = true;
		}
		if (cityStatsBtn) {
			cityStatsBtn.disabled = true;
		}
		currentCoords = null;
		currentAddress = null;

		console.log("getCurrentLocation");
		// Get current position
		navigator.geolocation.getCurrentPosition(
			async (position) => {
				resolve(position);
			},
			(error) => {
				reject(error);
			},
			{
				enableHighAccuracy: true,
				maximumAge: 0, // Don't use a cached position
				timeout: 10000, // 10 seconds
			},
		);
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

/* --------------
 * Camada de GUI
 * --------------------
 */
function displayPosition(position) {
	const latitude = position.coords.latitude;
	const longitude = position.coords.longitude;
	const altitude = position.coords.altitude;
	const precisao = position.coords.accuracy; // in meters
	const precisaoAltitude = position.coords.altitudeAccuracy;

	showCoords(
		locationResult,
		latitude,
		longitude,
		altitude,
		precisao,
		precisaoAltitude,
	);
	//renderAddress(position.address);
}

function displayError(error) {
	// Error callback
	let errorMessage;
	switch (error.code) {
		case error.PERMISSION_DENIED:
			errorMessage = "User denied the request for Geolocation.";
			break;
		case error.POSITION_UNAVAILABLE:
			errorMessage = "Location information is unavailable.";
			break;
		case error.TIMEOUT:
			errorMessage = "The request to get user location timed out.";
			break;
		case error.UNKNOWN_ERROR:
			errorMessage = "An unknown error occurred.";
			break;
	}
	locationResult.innerHTML = `<p class="error">Error: ${errorMessage}</p>`;
	findRestaurantsBtn.disabled = true;
	cityStatsBtn.disabled = true;
}
