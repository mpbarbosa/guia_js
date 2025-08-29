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

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/* ============================
 * Camada de Modelo
 * ============================
 */

class CurrentPosition {
	static instance = null;
	static strCurrPosUpdate = "CurrentPosition updated";
	static strCurrPosNotUpdate = "CurrentPosition not updated";

	static getInstance(position) {
		console.log("CurrentPosition.getInstance");
		if (!CurrentPosition.instance) {
			CurrentPosition.instance = new CurrentPosition(position);
		} else {
			CurrentPosition.instance.update(position);
		}
		return CurrentPosition.instance;
	}

	constructor(position) {
		console.log("CurrentPosition constructor");
		this.observers = [];
		this.accuracyQuality = null;
		this.tsPosicaoAtual = null;
		if (position) {
			this.update(position);
		}
	}

	subscribe(observer) {
		console.log(`(CurrentPosition) observer ${observer} subscribing ${this}`);
		if (observer) {
			this.observers.push(observer);
		}
		console.log(`(CurrentPosition) observers ${this.observers}`);
	}

	unsubscribe(observer) {
		this.observers = this.observers.filter((o) => o !== observer);
	}

	notifyObservers(posEvent) {
		console.log(
			"(CurrentPosition) CurrentPosition.notifyObservers: " + this.observers,
		);
		this.observers.forEach((observer) => {
			console.log("(CurrentPosition) Notifying observer:", observer);
			observer.update(this, posEvent);
		});
	}

	static getAccuracyQuality(accuracy) {
		if (accuracy <= 10) {
			return "excellent";
		} else if (accuracy <= 30) {
			return "good";
		} else if (accuracy <= 100) {
			return "medium";
		} else if (accuracy <= 200) {
			return "bad";
		} else {
			return "very bad";
		}
	}

	calculateAccuracyQuality() {
		return getAccuracyQuality(this.accuracy);
	}

	set accuracy(value) {
		this._accuracy = value;
		this.accuracyQuality = CurrentPosition.getAccuracyQuality(value);
		console.log("(CurrentPosition) Accuracy set to:", value);
		console.log("(CurrentPosition) Accuracy quality:", this.accuracyQuality);
	}

	update(position) {
		console.log("-----------------------------------------");
		console.log("(CurrentPosition) CurrentPosition.update");
		console.log("(CurrentPosition) this.tsPosicaoAtual:", this.tsPosicaoAtual);
		console.log("(CurrentPosition) position:", position);

		var bUpdateCurrPos = true;
		var error = null;

		// Verifica se a posição é válida
		if (!position || !position.timestamp) {
			console.warn("(CurrentPosition) Invalid position data:", position);
			return;
		}
		console.log("(CurrentPosition) position.timestamp:", position.timestamp);
		console.log(
			"(CurrentPosition) position.timestamp - this.tsPosicaoAtual:",
			position.timestamp - (this.tsPosicaoAtual || 0),
		);

		if (position.timestamp - (this.tsPosicaoAtual || 0) < 60000) {
			bUpdateCurrPos = false;
			error = {
				name: "ElapseTimeError",
				message: "Less than 1 minute since last update",
			};
			console.warn("(CurrentPosition) Less than 1 minute since last update.");
		}

		// Verifica se a precisão é boa o suficiente
		if (
			CurrentPosition.getAccuracyQuality(position.coords.accuracy) in
			["medium", "bad", "very bad"]
		) {
			bUpdateCurrPos = false;
			error = { name: "AccuracyError", message: "Accuracy is not good enough" };
			console.warn(
				"(CurrentPosition) Accuracy not good enough:",
				position.coords.accuracy,
			);
		}

		if (!bUpdateCurrPos) {
			this.notifyObservers(CurrentPosition.strCurrPosNotUpdate, null, error);
			console.log("(CurrentPosition) CurrentPosition not updated:", this);
			return;
		}

		// Atualiza a posição apenas se tiver passado mais de 1 minuto
		console.log("(CurrentPosition) Updating CurrentPosition...");
		this.position = position;
		this.coords = position.coords;
		this.latitude = position.coords.latitude;
		this.longitude = position.coords.longitude;
		this.accuracy = position.coords.accuracy;
		this.accuracyQuality = CurrentPosition.getAccuracyQuality(
			position.coords.accuracy,
		);
		this.altitude = position.coords.altitude;
		this.altitudeAccuracy = position.coords.altitudeAccuracy;
		this.heading = position.coords.heading;
		this.speed = position.coords.speed;
		this.timestamp = position.timestamp;
		this.tsPosicaoAtual = position.timestamp;
		console.log("(CurrentPosition) CurrentPosition updated:", this);
		this.notifyObservers(CurrentPosition.strCurrPosUpdate, null, error);
		console.log("(CurrentPosition) Notified observers.");
	}

	toString() {
		return `${this.constructor.name}: ${this.latitude}, ${this.longitude}, ${this.accuracyQuality}, ${this.altitude}, ${this.speed}, ${this.heading}, ${this.timestamp}`;
	}

	distanceTo(otherPosition) {
		return calculateDistance(
			this.latitude,
			this.longitude,
			otherPosition.latitude,
			otherPosition.longitude,
		);
	}
}

/* ============================
 * Camada de Serviço
 * ============================
 */

class SingletonStatusManager {
	constructor() {
		if (SingletonStatusManager.instance) {
			return SingletonStatusManager.instance;
		}

		this.gettingLocation = false;
		SingletonStatusManager.instance = this;
	}

	isGettingLocation() {
		return this.gettingLocation;
	}

	setGettingLocation(status) {
		console.log("Setting gettingLocation status to:", status);
		this.gettingLocation = status;
		if (status) {
			console.log("Getting location...");
		} else {
			console.log("Stopped getting location.");
		}
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

	getCacheKey() {
		// Override this method in subclasses to provide a unique cache key
		return this.url;
	}

	setUrl(url) {
		this.url = url;
		this.data = null;
		this.error = null;
		this.loading = false;
		this.lastFetch = 0;
		this.cache.clear();
		console.log("(APIFetcher) URL set to:", this.url);
		console.log("(APIFetcher) Notifying observers after URL change.");
		this.notifyObservers();
	}

	subscribe(observer) {
		console.log(`(APIFetcher) observer ${observer} subscribing ${this}`);
		if (observer) {
			this.observers.push(observer);
		}
	}

	unsubscribe(observer) {
		this.observers = this.observers.filter((o) => o !== observer);
	}

	notifyObservers() {
		console.log("(APIFetcher) Notifying observers: " + this.observers);
		this.observers.forEach((observer) => {
			console.log("(APIFetcher) Notifying observer:", observer);
			observer.update(this.data, this.error, this.loading);
		});
	}

	async fetchData() {
		const cacheKey = this.getCacheKey();
		if (this.cache.has(cacheKey)) {
			this.data = this.cache.get(cacheKey);
			return;
		}
		this.loading = true;

		try {
			console.log("Fetching data from URL:", this.url);
			const response = await fetch(this.url);
			console.log("Response status:", response.status);
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
		}
	}
}

class ReverseGeocoder extends APIFetcher {
	constructor(latitude, longitude) {
		console.log(
			"(ReverseGeocoder) Initializing ReverseGeocoder with latitude:",
			latitude,
			"and longitude:",
			longitude,
		);
		super("");
		this.latitude = latitude;
		this.longitude = longitude;
		Object.defineProperty(this, "currentAddress", {
			get: () => this.data,
			set: (value) => {
				this.data = value;
				console.log("(ReverseGeocoder) currentAddress set to:", value);
			},
		});
		console.log("(ReverseGeocoder) ReverseGeocoder initialized.");
	}

	setCoordinates(latitude, longitude) {
		this.latitude = latitude;
		this.longitude = longitude;
		this.url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${this.latitude}&lon=${this.longitude}&zoom=18&addressdetails=1`;
		this.data = null;
		this.error = null;
		this.loading = false;
		this.lastFetch = 0;
		this.cache.clear();
		console.log(
			"(ReverseGeocoder) Coordinates set to:",
			this.latitude,
			this.longitude,
		);
		this.notifyObservers();
	}

	getCacheKey() {
		return `${this.latitude},${this.longitude}`;
	}

	async fetchAddress() {
		return super.fetchData();
	}

	reverseGeocode() {
		console.log("(ReverseGeocoder) Performing reverse geocoding...");
		this.url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${this.latitude}&lon=${this.longitude}&zoom=18&addressdetails=1`;
		return new Promise((resolve, reject) => {
			this.fetchData()
				.then(() => {
					if (this.error) {
						reject(this.error);
					} else {
						resolve(this.data);
					}
				})
				.catch((error) => {
					reject(error);
				});
		});
	}

	update(position, posEvent) {
		console.log("(ReverseGeocoder) update called with position:", position);
		console.log("(ReverseGeocoder) Position event:", posEvent);
		// Only update if position has changed significantly (more than 20 meters)
		if (
			this.lastPosition &&
			position &&
			this.latitude &&
			this.longitude &&
			position.coords
		) {
			const distance = calculateDistance(
				this.latitude,
				this.longitude,
				position.coords.latitude,
				position.coords.longitude,
			);
			console.log(
				"(ReverseGeocoder) Distance from last position:",
				distance,
				"meters",
			);
			if (distance < 20) {
				console.log(
					"(ReverseGeocoder) Position change is less than 20 meters. Not updating.",
				);
				return;
			}
		}
		this.lastPosition = position;

		// Proceed with reverse geocoding if position is updated
		if (posEvent == CurrentPosition.strCurrPosUpdate) {
			SingletonStatusManager.getInstace().setGettingLocation(true);

			if (findRestaurantsBtn) {
				findRestaurantsBtn.disabled = true;
			}
			if (cityStatsBtn) {
				cityStatsBtn.disabled = true;
			}
			console.log("(ReverseGeocoder) update", position);
			this.setCoordinates(position.coords.latitude, position.coords.longitude);
			this.reverseGeocode()
				.then((addressData) => {
					console.log("(ReverseGeocoder) Address data obtained:", addressData);
					this.currentAddress = addressData;
					this.notifyObservers();
				})
				.catch((error) => {
					displayError(error);
				});
		}
	}

	toString() {
		return `${this.constructor.name}: ${this.latitude}, ${this.longitude}`;
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

class GeolocationService {
	constructor(element) {
		this.element = element;
		this.currentPosition = null;
		this.currentCoords = null;
		this.currentAddress = null;
		this.trackingInterval = null;
		this.locationResult = null;
		this.observers = [];
		this.gettingLocation = false;
		this.tsPosicaoAtual = null;
		this.tsPosicaoAnterior = null;
	}

	subscribe(observer) {
		if (observer == null) {
			console.warn(
				"(GeolocationService) Attempted to subscribe a null observer.",
			);
			return;
		}
		console.log(
			`(GeolocationService) observer ${observer} subscribing ${this}`,
		);
		this.observers.push(observer);
	}

	unsubscribe(observer) {
		this.observers = this.observers.filter((o) => o !== observer);
	}

	notifyObservers() {
		console.log(
			"(GeolocationService) Notifying observers of location update...",
		);
		this.observers.forEach((observer) => {
			console.log("Notifying observer:", observer);
			observer.update(this.currentPosition);
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
		console.log("(GeolocationService) Getting current location...");
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
					console.log("(GeolocationService) Position obtained:", position);
					resolve(CurrentPosition.getInstance(position));
				},
				(error) => {
					reject(error);
				},
				{
					enableHighAccuracy: true,
					maximumAge: 0, // Don't use a cached position
					timeout: 60000, // 60 seconds
				},
			);
		});
	}

	updatePosition(position) {
		console.log("(GeolocationService) watchPosition callback");
		SingletonStatusManager.getInstace().setGettingLocation(true);

		if (findRestaurantsBtn) {
			findRestaurantsBtn.disabled = true;
		}
		if (cityStatsBtn) {
			cityStatsBtn.disabled = true;
		}
		console.log("(GeolocationService) Position obtained:", position);
		this.currentPosition = position;
		this.currentCoords = position.coords;
		console.log("(GeolocationService) Notifying observers...");
		this.notifyObservers();
	}

	async watchCurrentLocation() {
		console.log("(GeolocationService) watchCurrentLocation");
		console.log("(GeolocationService) Getting current location...");
		this.checkGeolocation();
		return new Promise(async function (resolve, reject) {
			// Get current position
			navigator.geolocation.watchPosition(
				async (position) => {
					console.log("(GeolocationService) watchPosition callback");

					SingletonStatusManager.getInstace().setGettingLocation(true);
					if (findRestaurantsBtn) {
						findRestaurantsBtn.disabled = true;
					}
					if (cityStatsBtn) {
						cityStatsBtn.disabled = true;
					}
					console.log("(GeolocationService) Position obtained:", position);
					var currentPos = CurrentPosition.getInstance(position);
					resolve(currentPos);
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

	async getSingleLocationUpdate() {
		console.log("(GeolocationService) Getting single location update...");
		locationResult.innerHTML =
			'<p class="loading">Buscando a sua localização...</p>';

		if (findRestaurantsBtn) {
			findRestaurantsBtn.disabled = true;
		}
		if (cityStatsBtn) {
			cityStatsBtn.disabled = true;
		}

		return this.getCurrentLocation().then((position) => {
			console.log("(GeolocationService) Position obtained:", position);
			this.currentPosition = position;
			this.currentCoords = position.coords;
			this.notifyObservers();
			return position;
		});
	}

	async getWatchLocationUpdate() {
		console.log("(GeolocationService) getWatchLocationUpdate");
		locationResult.innerHTML =
			'<p class="loading">Buscando a sua localização...</p>';

		if (findRestaurantsBtn) {
			findRestaurantsBtn.disabled = true;
		}
		if (cityStatsBtn) {
			cityStatsBtn.disabled = true;
		}

		return this.watchCurrentLocation().then((position) => {
			console.log(
				"(GeolocationService) watchPosition callback received position:",
				position,
			);
			this.currentPosition = position;
			this.currentCoords = position.coords;
			console.log("(GeolocationService) Notifying observers...");
			this.notifyObservers();
			return position;
		});
	}

	toString() {
		return `${this.constructor.name}: ${this.currentCoords ? this.currentCoords.latitude : "N/A"}, ${this.currentCoords ? this.currentCoords.longitude : "N/A"}`;
	}
}

class WebGeocodingManager {
	constructor(document, resultElement) {
		console.log("(WebGeocodingManager) Initializing WebGeocodingManager...");
		this.document = document;
		this.locationResult = resultElement;
		this.observers = [];
		this.geolocationService = new GeolocationService(this.locationResult);
		this.reverseGeocoder = new ReverseGeocoder();
		this.currentPosition = null;
		this.currentCoords = null;
		this.positionDisplayer = new HTMLPositionDisplayer(locationResult);
		this.addressDisplayer = new HTMLAddressDisplayer(locationResult);

		this.initElements();

		CurrentPosition.getInstance().subscribe(this.positionDisplayer);
		this.reverseGeocoder.subscribe(this.addressDisplayer);

		console.log("(WebGeocodingManager) WebGeocodingManager initialized.");
	}

	initElements() {
		var chronometer = this.document.getElementById("chronometer");
		if (chronometer) {
			console.log("(WebGeocodingManager) Chronometer element found.");
			this.chronometer = new Chronometer(chronometer);
			CurrentPosition.getInstance().subscribe(this.chronometer);
		} else {
			console.warn("Chronometer element not found.");
		}

		this.findRestaurantsBtn = document.getElementById("find-restaurants-btn");
		if (this.findRestaurantsBtn) {
			this.findRestaurantsBtn.addEventListener("click", () => {
				if (this.currentCoords) {
					findNearbyRestaurants(
						this.currentCoords.latitude,
						this.currentCoords.longitude,
					);
				} else {
					alert("Current coordinates not available.");
				}
			});
		} else {
			console.warn("Find Restaurants button not found.");
		}

		this.cityStatsBtn = document.getElementById("city-stats-btn");
		if (this.cityStatsBtn) {
			this.cityStatsBtn.addEventListener("click", () => {
				if (this.currentCoords) {
					fetchCityStatistics(
						this.currentCoords.latitude,
						this.currentCoords.longitude,
					);
				} else {
					alert("Current coordinates not available.");
				}
			});
		} else {
			console.warn("City Stats button not found.");
		}

		this.tsPosCapture = this.document.getElementById("tsPosCapture");
		if (this.tsPosCapture) {
			this.tsPosCapture.textContent = new Date().toLocaleString();
			this.posCaptureHtmlText = new HtmlText(this.document, this.tsPosCapture);
			CurrentPosition.getInstance().subscribe(this.posCaptureHtmlText);
			Object.freeze(this.posCaptureHtmlText); // Prevent further modification
		} else {
			console.warn("tsPosCapture element not found.");
		}
	}

	subscribe(observer) {
		if (observer == null) {
			console.warn(
				"(WebGeocodingManager) Attempted to subscribe a null observer.",
			);
			return;
		}
		console.log(
			`(WebGeocodingManager) observer ${observer} subscribing ${this}`,
		);
		this.observers.push(observer);
	}

	unsubscribe(observer) {
		this.observers = this.observers.filter((o) => o !== observer);
	}

	initSpeechSynthesis() {
		this.htmlSpeechSynthesisDisplayer = new HtmlSpeechSynthesisDisplayer(
			this.document,
			{
				languageSelectId: "language",
				voiceSelectId: "voice-select",
				textInputId: "text-input",
				speakBtnId: "speak-btn",
				pauseBtnId: "pause-btn",
				resumeBtnId: "resume-btn",
				stopBtnId: "stop-btn",
				rateInputId: "rate",
				rateValueId: "rate-value",
				pitchInputId: "pitch",
				pitchValueId: "pitch-value",
			},
		);

		this.reverseGeocoder.subscribe(this.htmlSpeechSynthesisDisplayer);

		Object.freeze(this); // Prevent further modification
		console.log("WebGeocodingManager initialized.");
		this.notifyObservers();
	}

	notifyObservers() {
		console.log("(WebGeocodingManager) Notifying observers");
		for (const observer of this.observers) {
			observer.update(this.currentPosition);
		}
	}

	getSingleLocationUpdate() {
		console.log("(WebGeocodingManager) getSingleLocationUpdate");
		this.geolocationService
			.getSingleLocationUpdate()
			.then((position) => {
				console.log("(WebGeocodingManager) Position obtained:", position);
				if (position && position.coords) {
					this.reverseGeocoder.latitude = position.coords.latitude;
					this.reverseGeocoder.longitude = position.coords.longitude;
					return this.reverseGeocoder.reverseGeocode();
				} else {
					return null;
				}
			})
			.then((addressData) => {
				console.log(
					"(WebGeocodingManager) Address data obtained:",
					addressData,
				);
				this.reverseGeocoder.currentAddress = addressData;
				this.reverseGeocoder.notifyObservers();
			})
			.catch((error) => {
				displayError(error);
			});
	}

	updatePosition(position) {
		console.log("(WebGeocodingManager) updatePosition", position);
		this.reverseGeocoder.latitude = position.coords.latitude;
		this.reverseGeocoder.longitude = position.coords.longitude;
		this.reverseGeocoder
			.reverseGeocode()
			.then((addressData) => {
				console.log(
					"(WebGeocodingManager) Address data obtained:",
					addressData,
				);
				this.reverseGeocoder.currentAddress = addressData;
				this.reverseGeocoder.notifyObservers();
			})
			.catch((error) => {
				displayError(error);
			});
	}

	startTracking() {
		console.log("(WebGeocodingManager) Starting tracking...");

		this.initSpeechSynthesis();

		/*
    Get current location. Do an initial check to see
    if the user has granted location permissions. Do an immediate
    update.
    */
		console.log("(WebGeocodingManager) Checking geolocation permissions...");
		this.geolocationService
			.getSingleLocationUpdate()
			.then((position) => {
				this.reverseGeocoder.latitude = position.coords.latitude;
				this.reverseGeocoder.longitude = position.coords.longitude;
				return this.reverseGeocoder.reverseGeocode();
			})
			.then((addressData) => {
				console.log(
					"(WebGeocodingManager) Address data obtained:",
					addressData,
				);
				this.reverseGeocoder.currentAddress = addressData;
				this.reverseGeocoder.notifyObservers();
			})
			.catch((error) => {
				displayError(error);
			});
		setTimeout(() => {
			null;
		}, 20000);

		console.log("(WebGeocodingManager) Setting up periodic updates...");
		// Start watching position with high accuracy
		this.geolocationService.getWatchLocationUpdate().then((value) => {
			value.subscribe(this.positionDisplayer);
			value.subscribe(this.reverseGeocoder);
			//value.subscribe(this.htmlSpeechSynthesisDisplayer);
		});
	}

	toString() {
		return `${this.constructor.name}: ${this.currentCoords ? this.currentCoords.latitude : "N/A"}, ${this.currentCoords ? this.currentCoords.longitude : "N/A"}`;
	}
}

class Chronometer {
	constructor(element) {
		console.log("Initializing Chronometer...");
		this.element = element;
		this.startTime = null;
		this.elapsedTime = 0;
		this.timerInterval = null;
	}

	start() {
		console.log("Starting Chronometer...");
		if (this.timerInterval) {
			return; // Already running
		}
		this.startTime = Date.now() - this.elapsedTime;
		this.timerInterval = setInterval(() => {
			this.elapsedTime = Date.now() - this.startTime;
			this.updateDisplay();
		}, 1000);
	}

	stop() {
		if (!this.timerInterval) {
			return; // Not running
		}
		clearInterval(this.timerInterval);
		this.timerInterval = null;
	}

	reset() {
		this.stop();
		this.elapsedTime = 0;
		this.updateDisplay();
	}

	updateDisplay() {
		const totalSeconds = Math.floor(this.elapsedTime / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		this.element.textContent = `${String(hours).padStart(2, "0")}:${String(
			minutes,
		).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	}

	update(currentPosition, posEvent) {
		console.log("(Chronometer) update", currentPosition);
		// Start the chronometer when a new position is received
		// Stop it if no position is available
		if (posEvent == CurrentPosition.strCurrPosUpdate) {
			console.log("(Chronometer) Position event:", posEvent);
			if (this.timerInterval && currentPosition) {
				console.log("(Chronometer) Reseting chronometer...");
				this.reset();
				this.start();
			} else if (!this.timerInterval && currentPosition) {
				console.log("(Chronometer) Starting chronometer...");
				this.start();
			} else {
				console.log("(Chronometer) Stopping chronometer...");
				this.stop();
				this.reset();
			}
		}
	}

	toString() {
		return `${this.constructor.name}: ${this.element.textContent}`;
	}
}

/* --------------
 * Camada de GUI
 * --------------------
 */

class HTMLPositionDisplayer {
	constructor(element) {
		console.log("Initializing HTMLPositionDisplayer...");
		this.element = element;
		Object.freeze(this); // Prevent further modification
	}

	renderHtmlCoords(position) {
		console.log(
			"(HTMLPositionDisplayer) Rendering HTML coordinates: " + position,
		);
		// Extract coordinates
		// Format coordinates to 6 decimal places
		// Display coordinates
		// Provide link to Google Maps
		// Provide link to Google Street View
		if (!position || !position.coords) {
			return "<p class='error'>No position data available.</p>";
		}
		const latitude = position.coords.latitude;
		const longitude = position.coords.longitude;
		const altitude = position.coords.altitude;
		const precisao = position.coords.accuracy; // in meters
		const precisaoAltitude = position.coords.altitudeAccuracy;
		const direcao = position.coords.heading; // in degrees
		const velocidade = position.coords.speed; // in meters per second
		const timestamp = new Date(position.timestamp).toLocaleString();
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
		if (direcao) {
			html += `<p><strong>Direção:</strong> ${direcao.toFixed(2)}°</p>`;
		}
		if (velocidade) {
			html += `<p><strong>Velocidade:</strong> ${velocidade.toFixed(2)} m/s</p>`;
		}
		if (timestamp) {
			html += `<p><strong>Timestamp:</strong> ${timestamp}</p>`;
		}

		html += ` <p><a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank">Ver no Google Maps</a> 
  <a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}">Ver no Google Street View</a></p> `;

		return html;
	}

	showCoords(position) {
		var html = this.renderHtmlCoords(position);
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
		this.showCoords(position);

		// Enable buttons
		if (findRestaurantsBtn) {
			findRestaurantsBtn.disabled = false;
		}
	}
	update(currentPosition, posEvent, loading, error) {
		console.log("(HTMLPositionDisplayer) Updating position display...");
		console.log("(HTMLPositionDisplayer) currentPosition:", currentPosition);
		console.log("(HTMLPositionDisplayer) loading:", loading);
		console.log("(HTMLPositionDisplayer) error:", error);
		console.log("(HTMLPositionDisplayer) Position event:", posEvent);
		// Extract coordinates
		// Format coordinates to 6 decimal places
		// Display coordinates
		// Provide link to Google Maps
		// Provide link to Google Street View
		if (posEvent == CurrentPosition.strCurrPosUpdate) {
			const currentCoords = currentPosition ? currentPosition.coords : null;
			// Display loading or error messages if applicable
			// Otherwise, display the position
			if (loading) {
				this.element.innerHTML = '<p class="loading">Loading...</p>';
			} else if (error) {
				this.element.innerHTML = `<p class="error">Error: ${error.message}</p>`;
			} else if (currentCoords) {
				this.element.innerHTML = "";
				this.displayPosition(currentPosition);
			} else {
				this.element.innerHTML =
					'<p class="error">No position data available.</p>';
			}
		}
	}

	toString() {
		return `${this.constructor.name}: ${this.element.id}`;
	}
}

class EnderecoPadronizado {
	constructor() {
		this.municipio = null;
		this.logradouro = null;
		this.house_number = null;
		this.bairro = null;
		this.regiaoCidade = null;
	}

	logradouroCompleto() {
		return this.house_number
			? `${this.logradouro}, ${this.house_number}`
			: `${this.logradouro}, s/n`;
	}

	bairroCompleto() {
		return this.regiaoCidade
			? `${this.bairro}, ${this.regiaoCidade}`
			: this.bairro;
	}

	toString() {
		return `${this.constructor.name}: ${this.logradouroCompleto()}, ${this.bairroCompleto()}, ${this.municipio}`;
	}
}

class AddressDataExtractor {
	constructor(data) {
		console.log("Initializing AddressDataExtractor...");
		this.data = data;
		console.log("data:", data);
		this.enderecoPadronizado = new EnderecoPadronizado();
		this.padronizaEndereco();
		Object.freeze(this); // Prevent further modification
	}

	padronizaEndereco() {
		console.log("Padronizando endereço...");
		if (!this.data || !this.data.address) {
			console.warn("No address data to standardize.");
			return;
		}
		var address = this.data.address;
		this.enderecoPadronizado.logradouro = address.street || address.road;

		this.enderecoPadronizado.house_number = address.house_number || "";

		this.enderecoPadronizado.bairro = address.neighbourhood || address.suburb;

		if (address.neighbourhood && address.suburb) {
			this.enderecoPadronizado.regiaoCidade = address.suburb;
		}

		this.enderecoPadronizado.municipio =
			address.city || address.town || address.municipality || address.county;

		Object.freeze(this.enderecoPadronizado); // Prevent further modification
	}

	toString() {
		return `${this.constructor.name}: ${this.enderecoPadronizado.toString()}`;
	}
}

class HTMLAddressDisplayer {
	constructor(element) {
		console.log("(HTMLAddressDisplayer) Initializing...");
		this.element = element;
		Object.freeze(this); // Prevent further modification
	}

	renderAddress(data) {
		var addressTypeDescr;

		addressTypeDescr = getAddressType(data);

		var html = "";

		if (data.address) {
			var extractor = new AddressDataExtractor(data);
			var enderecoPadronizado = extractor.enderecoPadronizado;
			html += `<p><strong>Tipo:</strong> ${addressTypeDescr}<br>`;
			html += "<p><strong>Address Details:</strong></p><ul>";
			for (const [key, value] of Object.entries(data.address)) {
				html += `<li><strong>${key}:</strong> ${value}</li>`;
			}
			html += "</ul>";

			html += ` <strong>Logradouro/Número:</strong> ${enderecoPadronizado.logradouroCompleto()}<br>
    <strong>Bairro:</strong> ${enderecoPadronizado.bairroCompleto()}<br>
    <strong>Município/Cidade:</strong> ${enderecoPadronizado.municipio}<br>
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

	update(currentAddress, loading, error) {
		console.log("(HTMLAddressDisplayer) Updating address display...");
		console.log("currentAddress:", currentAddress);
		if (currentAddress) {
			console.log(
				"(HTMLAddressDisplayer) Updating address display with currentAddress:",
				currentAddress,
			);
			this.displayAddress(currentAddress);
		}
	}

	toString() {
		return `${this.constructor.name}: ${this.element.id}`;
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
	if (findRestaurantsBtn) {
		findRestaurantsBtn.disabled = true;
	}
	if (cityStatsBtn) {
		cityStatsBtn.disabled = true;
	}
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

	async getSpeechVoices() {
		return new Promise((resolve) => {
			// Check if voices are already loaded
			var voices = this.synth.getVoices();
			if (voices.length > 0) {
				resolve(voices);
				return;
			}

			// if not, wait for voices to be loaded
			window.speechSynthesis.onvoiceschanged = () => {
				voices = this.synth.getVoices();
				resolve(voices);
			};
		});
	}

	async loadVoices() {
		try {
			const availableVoices = await this.getSpeechVoices();
			console.log("(SpeechSynthesisManager) Voices loaded:", availableVoices);

			// You can now use the 'voices' array to populate a dropdown, select a specific voice, etc.
			if (availableVoices.length > 0) {
				this.voices = availableVoices;
				this.filteredVoices = this.voices.filter((voice) =>
					voice.lang.startsWith(this.language),
				);
				console.log(
					"(SpeechSynthesisManager) Filtered voices:",
					this.filteredVoices,
				);
				if (this.filteredVoices.length > 0) {
					this.voice = this.filteredVoices[0]; // Default to first voice in filtered list
				}
			} else {
				console.warn(
					"(SpeechSynthesisManager) No voices available for selected language:",
					this.language,
				);
			}
		} catch (error) {
			console.error("(SpeechSynthesisManager) Error loading voices:", error);
		}
	}

	setLanguage(selectedLanguage) {
		this.language = selectedLanguage;
		console.log("(SpeechSynthesisManager) Setting language to:", this.language);
		console.log("(SpeechSynthesisManager) Loading voices...");
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
		console.log("Speaking with voice:", this.voice);
		utterance.onend = () => {
			console.log("Speech synthesis finished.");
		};
		utterance.onerror = (event) => {
			console.error("Speech synthesis error:", event.error);
		};
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

	toString() {
		return `${this.constructor.name}: Language=${this.language}, Rate=${this.rate}, Pitch=${this.pitch}, Voice=${this.voice ? this.voice.name : "N/A"}`;
	}
}

class HtmlSpeechSynthesisDisplayer {
	constructor(document, elements) {
		console.log("Initializing HtmlSpeechSynthesisDisplayer...");
		this.document = document;
		this.elements = elements;
		console.log("Initializing speech manager...");
		this.speechManager = new SpeechSynthesisManager();
		console.log("Speech manager initialized.");
		this.init();
		Object.freeze(this); // Prevent further modification
	}
	//
	// Initialize the app
	init() {
		// Some browsers need this event to load voices
		// DOM elements
		console.log("Initializing DOM elements...");
		console.log("elements:", this.elements);
		this.textInput = this.document.getElementById(this.elements.textInputId);
		console.log("textInput:", this.textInput);
		this.speakBtn = this.document.getElementById(this.elements.speakBtnId);
		console.log("speakBtn:", this.speakBtn);
		this.pauseBtn = document.getElementById(this.elements.pauseBtnId);
		console.log("pauseBtn:", this.pauseBtn);
		this.resumeBtn = document.getElementById(this.elements.resumeBtnId);
		console.log("resumeBtn:", this.resumeBtn);
		this.stopBtn = document.getElementById(this.elements.stopBtnId);
		console.log("stopBtn:", this.stopBtn);
		this.voiceSelect = document.getElementById(this.elements.voiceSelectId);
		console.log("voiceSelect:", this.voiceSelect);
		this.languageSelect = document.getElementById(
			this.elements.languageSelectId,
		);
		console.log("languageSelect:", this.languageSelect);
		this.rateInput = document.getElementById(this.elements.rateInputId);
		console.log("rateInput:", this.rateInput);
		this.pitchInput = document.getElementById(this.elements.pitchInputId);
		console.log("pitchInput:", this.pitchInput);
		this.rateValue = document.getElementById(this.elements.rateValueId);
		console.log("rateValue:", this.rateValue);
		this.pitchValue = document.getElementById(this.elements.pitchValueId);
		console.log("pitchValue:", this.pitchValue);

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
				const option = document.createElement("option");
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

	getFullAddress(addressExtractor) {
		var enderecoPadronizado = addressExtractor.enderecoPadronizado;
		var parts = [];
		if (enderecoPadronizado.logradouro) {
			parts.push(enderecoPadronizado.logradouroCompleto());
		}
		if (enderecoPadronizado.bairro) {
			parts.push(enderecoPadronizado.bairroCompleto());
		}
		if (enderecoPadronizado.municipio) {
			parts.push(enderecoPadronizado.municipio);
		}
		return parts.join(", ");
	}

	buildTextToSpeech(currentAddress) {
		var addressExtractor = new AddressDataExtractor(currentAddress);
		var textToBeSpoken = `Você está em ${this.getFullAddress(addressExtractor)}.`;
		return textToBeSpoken;
	}

	update(currentAddress, error, loading) {
		console.log(
			"(HtmlSpeechSynthesisDisplayer) Updating speech synthesis display...",
		);
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

	tostring() {
		return `${this.constructor.name}: ${this.elements.textInputId}`;
	}
}

class HtmlText {
	constructor(document, element) {
		this.document = document;
		this.element = element;
		Object.freeze(this); // Prevent further modification
	}

	updateDisplay(text) {
		if (this.element) {
			this.element.textContent = text;
		}
	}

	update(currentPosition, posEvent) {
		console.log("(HtmlText) update", currentPosition, posEvent);
		if (!currentPosition) {
			this.updateDisplay("No position data available.");
			return;
		}
		var ts = new Date(currentPosition.timestamp);
		var tsStr = ts.toLocaleString();
		var posEventStr = posEvent ? `Event: ${posEvent}` : "";
		var coords = currentPosition.coords;
		if (coords) {
			var lat = coords.latitude.toFixed(6);
			var lon = coords.longitude.toFixed(6);
			var alt = coords.altitude ? coords.altitude.toFixed(2) + " m" : "N/A";
			var acc = coords.accuracy ? Math.round(coords.accuracy) + " m" : "N/A";
			var head = coords.heading ? coords.heading.toFixed(2) + "°" : "N/A";
			var speed = coords.speed ? coords.speed.toFixed(2) + " m/s" : "N/A";

			var text = posEventStr
				? `${posEventStr} | Lat: ${lat}, Lon: ${lon}, Alt: ${alt}, Acc: ${acc}, Head: ${head}, Speed: ${speed}`
				: `Lat: ${lat}, Lon: ${lon}, Alt: ${alt}, Acc: ${acc}, Head: ${head}, Speed: ${speed}`;
			text = (text || "") + ", Timestamp: " + (tsStr || "");
			console.log("(HtmlText) updateDisplay: ", text);
			this.updateDisplay(text);
		}
	}

	tostring() {
		return `${this.constructor.name}: ${this.element.id}`;
	}
}
