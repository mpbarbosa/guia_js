// Haversine distance calculation between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
	const R = 6371e3; // Earth radius in meters
	const φ1 = (lat1 * Math.PI) / 180;
	const φ2 = (lat2 * Math.PI) / 180;
	const Δφ = ((lat2 - lat1) * Math.PI) / 180;
	const Δλ = ((lon2 - lon1) * Math.PI) / 180;

	const a =
		Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
		Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}

class SingletonStatusManager {
	constructor() {
		if (SingletonStatusManager.instance) {
			return SingletonStatusManager.instance;
		}

		this.gettingLocation = false;
		SingletonStatusManager.instance = this;
	}

	setGettingLocation(status) {
		this.gettingLocation = status;
	}

	static getInstace() {
		this.instance = this.instance || new SingletonStatusManager();
		return this.instance;
	}
}

class APIFetcher {
	constructor(url) {
		this.url = url;
		this.observers = [];
		this.fetching = false;
		this.data = null;
		this.error = null;
		this.loading = false;
		this.lastFetch = 0;
		this.timeout = 10000;
		this.cache = new Map();
		this.lastPosition = null;
	}

	subscribe(observer) {
		this.observers.push(observer);
	}

	unsubscribe(observer) {
		this.observers = this.observers.filter((o) => o !== observer);
	}

	notifyObservers() {
		this.observers.forEach((observer) => {
			observer.update(this.data, this.error, this.loading);
		});
	}

	async fetchData() {
		const cacheKey = this.getCacheKey();
		if (this.cache.has(cacheKey)) {
			this.data = this.cache.get(cacheKey);
			this.notifyObservers();
			return;
		}
		this.loading = true;
		this.notifyObservers();

		try {
			const response = await fetch(this.url);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();
			this.data = data;
			this.cache.set(cacheKey, data);
		} catch (error) {
			this.error = error;
		} finally {
			this.loading = false;
			this.notifyObservers();
		}
	}
}

class ReverseGeocodeAPIFetcher extends APIFetcher {
	constructor(latitude, longitude) {
		const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
		super(url);
		this.latitude = latitude;
		this.longitude = longitude;
	}

	getCacheKey() {
		return `${this.latitude},${this.longitude}`;
	}

	async fetchAddress() {
		return super.fetchData();
	}
}

function getAddressType(address) {
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
	return addressTypeDescr;
}

async function fetchReverseGeocoding(position) {
	const latitude = position.coords.latitude;
	const longitude = position.coords.longitude;

	const fetcher = new ReverseGeocodeAPIFetcher(latitude, longitude);
	await fetcher.fetchAddress();
	const address = fetcher.data;
	return address;
}

class GeolocationService {
	constructor(element) {
		this.element = element;
		this.currentCoords = null;
		this.currentAddress = null;
		this.trackingInterval = null;
		this.locationResult = null;
		this.observers = [];
		this.gettingLocation = false;
	}

	subscribe(observer) {
		this.observers.push(observer);
	}

	unsubscribe(observer) {
		this.observers = this.observers.filter((o) => o !== observer);
	}

	notifyObservers() {
		this.observers.forEach((observer) => {
			observer.update(this.currentCoords, this.currentAddress);
		});
	}

	defaultOptions() {
		return {
			enableHighAccuracy: true,
			maximumAge: 0, // Don't use a cached position
			timeout: 10000, // 10 seconds
		};
	}

	checkGeolocation() {
		// Check if geolocation is supported by the browser
		var element = this.locationResult;
		if (element !== null) {
			if (!navigator.geolocation) {
				element.innerHTML =
					'<p class="error">O seu navegador não tem a funcionalidade de geolocalização.</p>';
			} else {
				element.innerHTML +=
					"<p>O seu navegador tem a funcionalidade de geolocalização.</p>";
			}
		}
	}

	async getCurrentLocation() {
		this.checkGeolocation();
		return new Promise(async function (resolve, reject) {
			// Get current position
			navigator.geolocation.getCurrentPosition(
				async (position) => {
					SingletonStatusManager.getInstace().setGettingLocation(true);

					if (findRestaurantsBtn) {
						findRestaurantsBtn.disabled = true;
					}
					if (cityStatsBtn) {
						cityStatsBtn.disabled = true;
					}
					currentCoords = null;
					currentAddress = null;
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

	getSingleLocationUpdate() {
		locationResult.innerHTML =
			'<p class="loading">Buscando a sua localização...</p>';

		if (findRestaurantsBtn) {
			findRestaurantsBtn.disabled = true;
		}
		if (cityStatsBtn) {
			cityStatsBtn.disabled = true;
		}

		this.getCurrentLocation()
			.then((position) => {
				this.notifyObservers();
				return position;
			})
			.then((position) => {
				return fetchReverseGeocoding(position);
			})
			.then((addressData) => {
				this.currentAddress = addressData;
				this.notifyObservers();
			})
			.catch((error) => {
				displayError(error);
			});
	}
}

function startTracking() {
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
	setTimeout(() => {
		null;
	}, 20000);

	// Then set up periodic updates
	trackingInterval = setInterval(() => {
		getSingleLocationUpdate();
	}, 20000); // Update every 20 seconds
}

function buildTextToSpeech(address) {
	var bairro = address.neibourhood;

	if (bairro) {
		bairro = bairro + ", " + address.suburb;
	} else {
		bairro = address.suburb;
	}
	const fBairro = bairro ? "Bairro " + bairro : "";
	return fBairro;
}

/* --------------
 * Camada de GUI
 * --------------------
 */

class HTMLPositionDisplayer {
	constructor(element) {
		this.element = element;
	}

	renderHtmlCoords(latitude, longitude, altitude, precisao, precisaoAltitude) {
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

	showCoords(latitude, longitude, altitude, precisao, precisaoAltitude) {
		html = this.renderHtmlCoords(
			latitude,
			longitude,
			altitude,
			precisao,
			precisaoAltitude,
		);
		// Display coordinates first
		const loc = `<div id="addressSection">
        <p class="loading">Looking up address...</p>
        </div>
        <div class="section" id="restaurantsSection" style="display:none;">
        <h3>Nearby Restaurants</h3>
        <div id="restaurantsList"></div>
        </div>
        <div class="section" id="cityStatsSection" style="display:none;">
        <h3>City Statistics</h3>
        <div id="cityStats"></div>
        </div> `;
		html += loc;
		// Display coordinates first
		this.element.innerHTML = html;
	}

	displayPosition(position) {
		const latitude = position.coords.latitude;
		const longitude = position.coords.longitude;
		const altitude = position.coords.altitude;
		const precisao = position.coords.accuracy; // in meters
		const precisaoAltitude = position.coords.altitudeAccuracy;

		showCoords(latitude, longitude, altitude, precisao, precisaoAltitude);

		// Enable buttons
		if (findRestaurantsBtn) {
			findRestaurantsBtn.disabled = false;
		}
	}
	update(currentCoords, currentAddress, loading, error) {
		if (loading) {
			this.element.innerHTML = '<p class="loading">Loading...</p>';
		} else if (error) {
			this.element.innerHTML = `<p class="error">Error: ${error.message}</p>`;
		} else if (currentCoords) {
			this.displayPosition(currentCoords);
		}
	}
}

class HTMLAddressDisplayer {
	constructor(element) {
		this.element = element;
	}
	renderAddress(data) {
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

	displayAddress(data) {
		var html = this.renderAddress(data);
		this.element.innerHTML += html;
	}

	update(currentCoords, currentAddress, loading, error) {
		if (currentAddress) {
			this.displayAddress(currentAddress);
		}
	}
}

function displayError(error) {
	// Error callback
	let errorMessage;
	console.log(error);
	console.log(error.code);
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
