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
		console.log("Getting current location...");
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
		console.log("Getting single location update...");
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
				console.log("Position obtained:", position);
				this.notifyObservers();
				return position;
			})
			.then((position) => {
				return fetchReverseGeocoding(position);
			})
			.then((addressData) => {
				console.log("Address data obtained:", addressData);
				this.currentAddress = addressData;
				this.notifyObservers();
			})
			.catch((error) => {
				displayError(error);
			});
	}

	startTracking() {
		console.log("Starting tracking...");
		/*
  Get current location. Do an initial check to see
  if the user has granted location permissions. Do an immediate
  update.
  */

		console.log("Checking geolocation permissions...");
		this.getSingleLocationUpdate();
		setTimeout(() => {
			null;
		}, 20000);

		console.log("Setting up periodic updates...");
		// Then set up periodic updates
		var trackingInterval = setInterval(() => {
			console.log("Periodic location update...");
			this.getSingleLocationUpdate();
		}, 20000); // Update every 20 seconds
	}
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

/* ============================
 * Voz do guia
 * ============================
 */

class SpeechSynthesisManager {
	constructor() {
		console.log("Initializing speech manager...");
		this.synth = window.speechSynthesis;
		this.language = "pt-BR"; // Default language
		this.voices = [];
		this.fileteredVoices = [];
		this.rate = 1;
		this.pitch = 1;
		this.voice = null;
		this.loadVoices();
	}

	getSpeechSynthesisVoices() {
		return new Promise((resolve) => {
			// Check if voices are already loaded
			var voices = window.speechSynthesis.getVoices();
			if (this.voices.length > 0) {
				resolve(voices);
				return;
			}

			// If not loaded, wait for the 'voiceschanged' event
			window.speechSynthesis.onvoiceschanged = () => {
				voices = window.speechSynthesis.getVoices();
				resolve(voices);
			};
		});
	}

	async loadVoices() {
		try {
			const availableVoices = await getSpeechVoices();
			console.log("Available voices:", availableVoices);

			// You can now use these voices for speech synthesis
			if (availableVoices.length > 0) {
				const utterance = new SpeechSynthesisUtterance("Hello, world!");
				utterance.voice = availableVoices[0]; // Use the first available voice
				window.speechSynthesis.speak(utterance);
			} else {
				console.log("No speech synthesis voices found.");
			}
		} catch (error) {
			console.error("Error getting voices:", error);
		} finally {
			this.voices = availableVoices;
		}
	}

	setLanguage(selectedLanguage) {
		this.language = selectedLanguage;
		console.log("Setting language to:", this.language);
		console.log("Loading voices...");
		this.loadVoices();
		this.filteredVoices = this.voices.filter((voice) =>
			voice.lang.startsWith(this.language),
		);
		if (this.filteredVoices.length > 0) {
			this.voice = this.filteredVoices[0]; // Default to first voice in filtered list
		}
		console.log("Filtered voices:", this.filteredVoices);
	}

	setSelectectedVoiceIndex(index) {
		console.log("Setting selected voice index to:", index);
	}

	speak(text) {
		if (this.synth.speaking) {
			console.warn("Speech synthesis is already speaking.");
			return;
		}
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.voice = this.voice;
		utterance.rate = this.rate;
		utterance.pitch = this.pitch;
		this.synth.speak(utterance);
	}

	pause() {
		if (this.synth.speaking) {
			this.synth.pause();
		}
	}

	resume() {
		if (this.synth.paused) {
			this.synth.resume();
		}
	}

	stop() {
		if (this.synth.speaking || this.synth.paused) {
			this.synth.cancel();
		}
	}
}

class HtmlSpeechSynthesisDisplayer {
	constructor(elements, document) {
		console.log("Initializing HtmlSpeechSynthesisDisplayer...");
		this.elements = elements;
		this.document = document;
		console.log("Initializing speech manager...");
		this.speechManager = new SpeechSynthesisManager();
		console.log("Speech manager initialized.");
		this.init();
	}
	//
	// Initialize the app
	init() {
		// Some browsers need this event to load voices
		// DOM elements
		console.log("Initializing DOM elements...");
		this.textInput = this.document.getElementById(this.elements.textInputId);
		this.speakBtn = this.document.getElementById(this.elements.speakBtnId);
		this.pauseBtn = this.document.getElementById(this.elements.pauseBtnId);
		this.resumeBtn = this.document.getElementById(this.elements.resumeBtnId);
		this.stopBtn = this.document.getElementById(this.elements.stopBtnId);
		this.voiceSelect = this.document.getElementById(
			this.elements.voiceSelectId,
		);
		this.languageSelect = this.document.getElementById(
			this.elements.languageSelectId,
		);
		this.rateInput = this.document.getElementById(this.elements.rateInputId);
		this.pitchInput = this.document.getElementById(this.elements.pitchInputId);
		this.rateValue = this.document.getElementById(this.elements.rateValueId);
		this.pitchValue = this.document.getElementById(this.elements.pitchValueId);

		// Set up event listeners
		this.speakBtn.addEventListener("click", this.speak);
		this.pauseBtn.addEventListener("click", this.pauseSpeech);
		this.resumeBtn.addEventListener("click", this.resumeSpeech);
		this.stopBtn.addEventListener("click", this.stopSpeech);
		this.languageSelect.addEventListener("change", this.loadVoices);
		this.voiceSelect.addEventListener("change", () => {
			this.speechManager.selectedVoiceIndex(this.voiceSelect.value);
		});
		this.rateInput.addEventListener("input", this.updateRate);
		this.pitchInput.addEventListener("input", this.updatePitch);

		this.loadVoices();
	}
	// Load available voices
	loadVoices() {
		this.speechManager.setLanguage(this.languageSelect.value);

		// Populate voice dropdown
		this.voiceSelect.innerHTML = "";
		var filteredVoices = this.speechManager.filteredVoices;
		if (filteredVoices.length > 0) {
			filteredVoices.forEach((voice, index) => {
				const option = this.document.createElement("option");
				option.value = index;
				option.textContent = `${voice.name} (${voice.lang})`;
				this.voiceSelect.appendChild(option);
			});
		} else {
			const option = document.createElement("option");
			option.textContent = "No voices available for selected language";
			this.voiceSelect.appendChild(option);
			console.warn(
				"No voices available for language:",
				this.speechManager.language,
			);
		}
	}

	updateRate() {
		var rate = rateInput.value;
		this.speechManager.rate = rate;
		this.rateValue.textContent = value;
	}

	updatePitch(pitch) {
		this.speechManager.pitch = pitch;
		pitchValue.textContent = pitchInput.value;
	}

	speak() {
		var text = "";

		if (this.textInput && this.textInput.value) {
			text = this.textInput.value.trim();
		}

		if (text === "") {
			return;
		}

		// Stop any current speech
		this.stop();
		this.speechManager.speak(text);
	}
	// Speak function
	speak2(textToBeSpoken, textAlert) {
		// Set selected voice
		const selectedVoiceIndex = voiceSelect.value;
		console.log("selectedVoiceIndex:", selectedVoiceIndex);
		console.log("voices: ", filteredVoices);
		if (selectedVoiceIndex && filteredVoices[selectedVoiceIndex]) {
			console.log("voice:", filteredVoices[selectedVoiceIndex]);
			currentUtterance.voice = filteredVoices[selectedVoiceIndex];
		}

		// Set speech parameters
		currentUtterance.rate = parseFloat(rateInput.value);
		currentUtterance.pitch = parseFloat(pitchInput.value);
		currentUtterance.volume = 1;

		// Event listeners
		currentUtterance.onstart = function () {
			speakBtn.disabled = true;
			pauseBtn.disabled = false;
			stopBtn.disabled = false;
		};

		currentUtterance.onend = function () {
			speakBtn.disabled = false;
			pauseBtn.disabled = true;
			resumeBtn.disabled = true;
			stopBtn.disabled = true;
			currentUtterance = null;
		};

		currentUtterance.onpause = function () {
			pauseBtn.disabled = true;
			resumeBtn.disabled = false;
		};

		currentUtterance.onresume = function () {
			pauseBtn.disabled = false;
			resumeBtn.disabled = true;
		};

		currentUtterance.onerror = function (event) {
			console.error("Speech error:", event.error);
			speakBtn.disabled = false;
			pauseBtn.disabled = true;
			resumeBtn.disabled = true;
			stopBtn.disabled = true;
			currentUtterance = null;
		};

		console.log("language:", currentUtterance.lang);
		console.log("voice:", currentUtterance.voice);
		console.log("rate:", currentUtterance.rate);
		console.log("pitch:", currentUtterance.pitch);

		window.speechSynthesis.cancel();
		window.speechSynthesis.speak(currentUtterance);
	}

	pause() {
		this.speechManager.pause();
	}

	resume() {
		this.speechManager.resume();
	}

	stop() {
		this.speechManager.stop();
	}

	buildTextToSpeech(currentAddress) {
		var address = currentAddress.address;
		var bairro = address.neibourhood;

		if (bairro) {
			bairro = bairro + ", " + address.suburb;
		} else {
			bairro = address.suburb;
		}
		const fBairro = bairro ? "Bairro " + bairro : "";
		return fBairro;
	}

	update(currentCoords, currentAddress, error, loading) {
		console.log("Updating speech synthesis display...");
		console.log("currentAddress:", currentAddress);
		if (currentAddress) {
			this.loadVoices();
			var textToBeSpoken = "";
			textToBeSpoken += this.buildTextToSpeech(currentAddress);
			console.log("textToBeSpoken:", textToBeSpoken);
			this.textInput.value = textToBeSpoken;
			this.speak(textToBeSpoken);
		}
	}
}
