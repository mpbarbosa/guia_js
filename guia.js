// Semantic Versioning 2.0.0 - see https://semver.org/
// Version object for unstable development status
const guiaVersion = {
  major: 0,
  minor: 3,
  patch: 0,
  prerelease: 'alpha', // Indicates unstable development
  toString: function() {
    return `${this.major}.${this.minor}.${this.patch}-${this.prerelease}`;
  }
};


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

const log = (message, ...params) => {
	//get all params after message and concatenate them
  const fullMessage = `[${new Date().toISOString()}] ${message} ${params.join(" ")}`;
  console.log(fullMessage);
  if (typeof document !== 'undefined') {
	//TODO: Remover a referência direta ao elemento HTML
    if (document.getElementById("bottom-scroll-textarea")) {
      (document.getElementById("bottom-scroll-textarea")).innerHTML += `${fullMessage}\n`;
    }
  }
};

const warn = (message, ...params) => {
  console.warn(message, ...params);
  if (typeof document !== 'undefined') {
    const logContainer = document.getElementById("bottom-scroll-textarea");
    if (logContainer) {
      logContainer.innerHTML += `${message} ${params.join(" ")}\n`;
    }
  }
};

// Example usage:
log("Guia.js version:", guiaVersion.toString());

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
		log(
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
		log("-----------------------------------------");
		log("(CurrentPosition) CurrentPosition.update");
		log("(CurrentPosition) this.tsPosPosicaoAtual:", this.tsPosicaoAtual);
		log("(CurrentPosition) position:", position);

		var bUpdateCurrPos = true;
		var error = null;

		// Verifica se a posição é válida
		if (!position || !position.timestamp) {
			warn("(CurrentPosition) Invalid position data:", position);
			return;
		}
		log("(CurrentPosition) position.timestamp:", position.timestamp);
		log(
			"(CurrentPosition) position.timestamp - this.tsPosicaoAtual:",
			position.timestamp - (this.tsPosicaoAtual || 0),
		);

		if (position.timestamp - (this.tsPosicaoAtual || 0) < 60000) {
			bUpdateCurrPos = false;
			error = {
				name: "ElapseTimeError",
				message: "Less than 1 minute since last update",
			};
			warn("(CurrentPosition) Less than 1 minute since last update.");
		}

		// Verifica se a precisão é boa o suficiente
		if (
			CurrentPosition.getAccuracyQuality(position.coords.accuracy) in
			["medium", "bad", "very bad"]
		) {
			bUpdateCurrPos = false;
			error = { name: "AccuracyError", message: "Accuracy is not good enough" };
			warn(
				"(CurrentPosition) Accuracy not good enough:",
				position.coords.accuracy,
			);
		}

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
				"(CurrentPosition) Distance from last position:",
				distance,
				"meters",
			);
			if (distance < 20) {
				console.log(
					"(CurrentPosition) Position change is less than 20 meters. Not updating.",
				);
				return;
			}
		}
		this.lastPosition = position;

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
		log("(APIFetcher) Notifying observers: " + this.observers);
		this.observers.forEach((observer) => {
			log("(APIFetcher) Notifying observer:", observer);
			log("First param:", this.firstUpdateParam());
			log("Second param:", this.secondUpdateParam());
			observer.update(
				this.firstUpdateParam(),
				this.secondUpdateParam(),
				this.error,
				this.loading,
			);
		});
	}

	firstUpdateParam() {
		return this.data;
	}

	secondUpdateParam() {
		return null;
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

		// Proceed with reverse geocoding if position is updated
		if (posEvent == CurrentPosition.strCurrPosUpdate) {
			SingletonStatusManager.getInstace().setGettingLocation(true);

			console.log("(ReverseGeocoder) update", position);
			this.setCoordinates(position.coords.latitude, position.coords.longitude);
			this.reverseGeocode()
				.then((addressData) => {
					console.log("(ReverseGeocoder) Address data obtained:", addressData);
					this.currentAddress = addressData;
					//TODO: #23 Remover dependencia de AddressDataExtractor no ReverseGeocoder
					console.log("(ReverseGeocoder) Extracting standardized address...");
					this.enderecoPadronizado =
						AddressDataExtractor.getEnderecoPadronizado(addressData);
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

	secondUpdateParam() {
		return this.enderecoPadronizado;
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
				console.log("Your browser does not support geolocation.");
			} else {
				element.innerHTML +=
					"<p>O seu navegador tem a funcionalidade de geolocalização.</p>";
				console.log("Your browser supports geolocation.");
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
		console.log("(GeolocationService) locationResult:", locationResult);

		SingletonStatusManager.getInstace().setGettingLocation(true);

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
		console.log("(GeolocationService) locationResult:", locationResult);

		SingletonStatusManager.getInstace().setGettingLocation(true);

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
		this.functionObservers = [];
		this.currentPosition = null;
		this.currentCoords = null;
		
		this.initElements();

		this.geolocationService = new GeolocationService(this.locationResult);
		this.reverseGeocoder = new ReverseGeocoder();

		this.positionDisplayer = new HTMLPositionDisplayer(locationResult);
		this.addressDisplayer = new HTMLAddressDisplayer(locationResult);


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

	subscribeFunction(observerFunction) {
		if (observerFunction == null) {
			console.warn(
				"(WebGeocodingManager) Attempted to subscribe a null observer function.",
			);
			return;
		}
		console.log(
			`(WebGeocodingManager) observer function ${observerFunction} subscribing ${this}`,
		);
		this.functionObservers.push(observerFunction);
	}

	unsubscribeFunction(observerFunction) {
		this.functionObservers = this.functionObservers.filter(
			(fn) => fn !== observerFunction,
		);
	}

	getEnderecoPadronizado() {
		return this.reverseGeocoder.enderecoPadronizado;
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

		console.log("WebGeocodingManager initialized.");
		this.notifyObservers();
	}

	notifyObservers() {
		console.log("(WebGeocodingManager) Notifying observers");
		for (const observer of this.observers) {
			observer.update(this.currentPosition);
		}
	}

	notifyFunctionObservers() {
		console.log("(WebGeocodingManager) Notifying function observers");
		for (const fn of this.functionObservers) {
			console.log("(WebGeocodingManager) Notifying function observer:", fn);
			console.log(
				"(WebGeocodingManager) Current position:",
				this.currentPosition,
			);
			console.log(
				"(WebGeocodingManager) Current address:",
				this.reverseGeocoder.currentAddress,
			);
			console.log(
				"(WebGeocodingManager) Standardized address:",
				this.reverseGeocoder.enderecoPadronizado,
			);
			fn(
				this.currentPosition,
				this.reverseGeocoder.currentAddress,
				this.reverseGeocoder.enderecoPadronizado,
			);
		}
	}

	getSingleLocationUpdate() {
		console.log("(WebGeocodingManager) getSingleLocationUpdate");
		this.geolocationService
			.getSingleLocationUpdate()
			.then((position) => {
				console.log("(WebGeocodingManager) Position obtained:", position);
				if (position && position.coords) {
					this.currentPosition = position;
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
				this.reverseGeocoder.enderecoPadronizado =
					AddressDataExtractor.getEnderecoPadronizado(addressData);
				this.reverseGeocoder.notifyObservers();
				this.notifyFunctionObservers();
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
		log("(WebGeocodingManager) Starting tracking...");

		this.initSpeechSynthesis();

		/*
    Get current location. Do an initial check to see
    if the user has granted location permissions. Do an immediate
    update.
    */
		log("(WebGeocodingManager) Checking geolocation permissions...");

		//this.geolocationService.checkPermissions().then((value) => {
		this.getSingleLocationUpdate();
		//});

		setTimeout(() => {
			null;
		}, 20000);

		log("(WebGeocodingManager) Setting up periodic updates...");
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

        let html = `<details class="coords-details" closed>
            <summary><strong>Coordinates Details</strong></summary>`;
        if (latitude) {
            html += `<p><strong>Latitude:</strong> ${latitude.toFixed(6)}</p>`;
        }
        if (longitude) {
            html += `<p><strong>Longitude:</strong> ${longitude.toFixed(6)}</p>`;
        }
        if (altitude) {
            html += `<p><strong>Altitude:</strong> ${altitude.toFixed(2)} metros</p>`;
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
        html += `<p>
            <a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank">Ver no Google Maps</a>
            <a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}">Ver no Google Street View</a>
        </p>
        </details>`;

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
		console.log("(HTMLPositionDisplayer) Coordinates displayed.");
	}

	displayPosition(position) {
		this.showCoords(position);
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
				console.log("(HTMLPositionDisplayer) Element cleared.");
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
		this.uf = null;
		this.siglaUf = null;
		this.cep = null;
		this.pais = null;
		this.codigoPais = null;
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

class GeoDataParser {
	constructor(data) {
		console.log("Initializing GeoDataParser...");
		this.data = data;
	}

	parse() {
		console.log("Parsing geo data...");
		// Implement parsing logic here
		log("(GeoDataParser) Check if there is reference place.");
		this.referencePlace = GeoDataExtractor.isReferencePlace(this.data) ? new ReferencePlace(this.data) : null;
	}
}

class GeoDataExtractor {
	constructor(data) {
		console.log("Initializing GeoDataExtractor...");
		this.data = data;
	}

	extract() {
		console.log("Extracting geo data...");
		// Implement extraction logic here
	}

	static isReferencePlace(data) {
		log("(GeoDataExtractor) Check if address data belong to a reference place.");
		return ReferencePlaceExtractor.isReferencePlace(data);
	}
}

class GeoDataValidator {
	constructor(data) {
		console.log("Initializing GeoDataValidator...");
		this.data = data;
	}

	validate() {
		console.log("Validating geo data...");
		// Implement validation logic here
	}
}

class GeoDataFormatter {
	constructor(data) {
		console.log("Initializing GeoDataFormatter...");
		this.data = data;
	}

	format() {
		console.log("Formatting geo data...");
		// Implement formatting logic here
	}
}

class GeoDataPresenter {
	constructor(element) {
		console.log("Initializing GeoDataPresenter...");
		this.element = element;
	}

	present(data) {
		console.log("Presenting geo data...");
		// Implement presentation logic here
	}
}	

class ReferencePlaceExtractor {
	constructor(data) {
		console.log("Initializing ReferencePlaceExtractor...");
		this.data = data;
		this.extract();
		Object.freeze(this);
	}

	extract() {
		console.log("Extracting reference place data...");
		// Implement extraction logic here
		this.placeClass = this.data["class"];
		this.placeType = this.data["type"];
		this.placeName = this.data["name"];
	}

	static isReferencePlace(data) {
		let validRefPlaceClasses = ['shop'];
		let refPlaceClass = (new ReferencePlaceExtractor(data)).placeClass;
		log(`(ReferencePlaceExtractor) class: ${refPlaceClass}`)
		return validRefPlaceClasses.includes(refPlaceClass);
	}
}

class ReferencePlaceValidator {
	constructor(data) {
		console.log("Initializing ReferencePlaceValidator...");
		this.data = data;
	}

	validate() {
		console.log("Validating reference place data...");
		// Implement validation logic here
	}
}

class ReferencePlaceFormatter {
	constructor(data) {
		console.log("Initializing ReferencePlaceFormatter...");
		this.data = data;
	}

	format() {
		console.log("Formatting reference place data...");
		// Implement formatting logic here
	}
}

class ReferencePlaceDisplayer {
	constructor(element) {
		console.log("Initializing ReferencePlaceDisplayer...");
		this.element = element;
	}	display(data) {
		console.log("Displaying reference place data...");
		// Implement display logic here
	}
}

class ReferencePlace {
	constructor(data) {
		console.log("Initializing ReferencePlace...");
		this.data = data;
		this.extractor = new ReferencePlaceExtractor(data);
		this.validator = new ReferencePlaceValidator(data);
		this.formatter = new ReferencePlaceFormatter(data);
		this.displayer = new ReferencePlaceDisplayer();
		this.presenter = new ReferencePlacePresenter();
		this.process();
		Object.freeze(this); // Prevent further modification
	}	
	
	process() {
		console.log("Processing reference place data...");
		// Implement processing logic here
		this.placeClass = this.extractor.placeClass;
		this.placdType = this.extractor.placeType;
		this.placeName = this.extractor.placeName;

		this.validator.validate();
		this.formatter.format();
		this.displayer.display();
		//this.presenter.present();
	}
}
class ReferencePlacePresenter {
	constructor(element) {
		console.log("Initializing ReferencePlacePresenter...");
		this.element = element;
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

		console.log("address.state:", address.state);
		this.enderecoPadronizado.uf = address.state || "";

		this.enderecoPadronizado.cep = address.postcode || "";

		this.enderecoPadronizado.pais = address.country || "";

		this.enderecoPadronizado.codigoPais = address.country_code
			? address.country_code.toUpperCase()
			: "";

		// Extract state code from ISO3166-2-lvl4 if available
		// Example format: "BR-SP" for São Paulo, Brazil
		console.log("this.data['ISO3166-2-lvl4']:", address["ISO3166-2-lvl4"]);
		if (address["ISO3166-2-lvl4"]) {
			var pattern = /^BR-(\w{2})$/;
			var match = address["ISO3166-2-lvl4"].match(pattern);
			if (match) {
				this.enderecoPadronizado.siglaUf = match[1];
			}
		}

		Object.freeze(this.enderecoPadronizado); // Prevent further modification
	}

	toString() {
		return `${this.constructor.name}: ${this.enderecoPadronizado.toString()}`;
	}

	static getEnderecoPadronizado(data) {
		const extractor = new AddressDataExtractor(data);
		return extractor.enderecoPadronizado;
	}
}

class HTMLAddressDisplayer {
	constructor(element) {
		console.log("(HTMLAddressDisplayer) Initializing...");
		this.element = element;
		Object.freeze(this); // Prevent further modification
	}

	renderAddress(geodataParser, enderecoPadronizado) {
		console.log("(HTMLAddressDisplayer) Rendering address:", geodataParser.data);
		console.log(
			"(HTMLAddressDisplayer) enderecoPadronizado:",
			enderecoPadronizado,
		);
		// Render address data into HTML
		// Display address components in a structured format
		// Handle missing components gracefully
		// Include links to view the address on a map service if coordinates are available
		// Return the generated HTML string

		// Check if data is valid
		if (!geodataParser.data || !geodataParser.data.address) {
			return "<p class='error'>No address data available.</p>";
		}

		// Determine address type
		var addressTypeDescr;

		addressTypeDescr = getAddressType(geodataParser.data);

		let html = "";
		log('(HTMLAddressDisplayer) Check if there is reference place.');
		if (geodataParser.referencePlace) {
			log('(HTMLAddressDiplayer) Yes, there is a reference place.')
			html +=  `<p><strong>Referência:</strong> ${geodataParser.referencePlace.placeName}</p>`;
		}
		if (geodataParser.data.address) {
			html += `<p><strong>Tipo:</strong> ${addressTypeDescr}<br>`;
			html += "<p><strong>Address Details:</strong></p><ul>";
			for (const [key, value] of Object.entries(geodataParser.data.address)) {
				html += `<li><strong>${key}:</strong> ${value}</li>`;
			}
			html += "</ul>";

			if (enderecoPadronizado) {
				html += ` <strong>Logradouro/Número:</strong> ${enderecoPadronizado.logradouroCompleto()}<br>
    <strong>Bairro:</strong> ${enderecoPadronizado.bairroCompleto()}<br>
    <strong>Município/Cidade:</strong> ${enderecoPadronizado.municipio}<br>`;
			}

			html += '<p>';
			html += `<strong>Detalhes do endereço (raw):</strong><br>
	${geodataParser.data.address.road || geodataParser.data.address.street || ""} ${geodataParser.data.address.house_number || ""}<br>
	${geodataParser.data.address.neighbourhood || geodataParser.data.address.suburb || ""}<br>
    ${geodataParser.data.address.municipality}<br>
    ${geodataParser.data.address.county}<br>
    <strong>UF:</strong> ${geodataParser.data.address.state}<br>
    <strong>Região:</strong> ${geodataParser.data.address.region}<br>
    <strong>CEP:</strong> ${geodataParser.data.address.postcode}<br>
    <strong>País:</strong> ${geodataParser.data.address.country}<br>
    <strong>Código do país:</strong> ${geodataParser.data.address.country_code}<br>
    <strong>Boundingbox</strong>: ${geodataParser.data.boundingbox} </p> `;

			html += '<details close><summary>(Raw Data) Dados em formato JSON</summary>';
			html += `${JSON.stringify(geodataParser.data)}`;
			html += '</details>';
		}

		return html;
	}

	displayAddress(data, enderecoPadronizado) {
		let geodataParser = new GeoDataParser(data);
		geodataParser.parse();
		let html = this.renderAddress(geodataParser, enderecoPadronizado);
		console.log("(HTMLAddressDisplayer) Address rendered.");
		this.element.innerHTML += html;
	}

	update(currentAddress, enderecoPadronizado, loading, error) {
		console.log("(HTMLAddressDisplayer) Updating address display...");
		console.log("(HTMLAddressDisplayer) currentAddress:", currentAddress);
		console.log(
			"(HTMLAddressDisplayer) enderecoPadronizado:",
			enderecoPadronizado,
		);
		if (currentAddress) {
			console.log(
				"(HTMLAddressDisplayer) Updating address display with currentAddress:",
				currentAddress,
			);
			if (this.findRestaurantsBtn) {
				this.findRestaurantsBtn.disabled = true;
			}
			if (this.cityStatsBtn) {
				this.cityStatsBtn.disabled = true;
			}
			this.displayAddress(currentAddress, enderecoPadronizado);
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
	/*if (findRestaurantsBtn) {
		findRestaurantsBtn.disabled = true;
	}
	if (cityStatsBtn) {
		cityStatsBtn.disabled = true;
	}*/
}

/* ============================
 * Voz do guia
 * ============================
 */

class SpeechSynthesisManager {
	constructor() {
		log("Initializing speech manager...");
		this.synth = window.speechSynthesis;
		this.language = "pt-BR"; // Default language
		this.voices = [];
		this.filteredVoices = [];
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
			log("(SpeechSynthesisManager) Voices loaded:", availableVoices);

			// You can now use the 'voices' array to populate a dropdown, select a specific voice, etc.
			if (availableVoices.length > 0) {
				this.voices = availableVoices;
				this.filteredVoices = this.voices.filter((voice) =>
					voice.lang.startsWith(this.language),
				);
				log(
					"(SpeechSynthesisManager) Filtered voices:",
					this.filteredVoices,
				);
				if (this.filteredVoices.length > 0) {
					this.voice = this.filteredVoices[0]; // Default to first voice in filtered list
				}
			} else {
				warn(
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
		log("(SpeechSynthesisManager) Setting language to:", this.language);
		log("(SpeechSynthesisManager) Loading voices...");
		this.loadVoices();
		this.filteredVoices = this.voices.filter((voice) =>
			voice.lang.startsWith(this.language),
		);
		if (this.filteredVoices.length > 0) {
			this.voice = this.filteredVoices[0]; // Default to first voice in filtered list
		}
		log("Filtered voices:", this.filteredVoices);
	}

	setSelectectedVoiceIndex(index) {
		log("Setting selected voice index to:", index);
	}

	speak(text) {
		if (this.synth.speaking) {
			warn("Speech synthesis is already speaking.");
			return;
		}
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.voice = this.voice;
		utterance.rate = this.rate;
		utterance.pitch = this.pitch;
		log("Speaking with voice:", this.voice);
		utterance.onend = () => {
			log("Spoke with voice:", this.voice);
			log("Speech synthesis finished.");
		};
		utterance.onerror = (event) => {
			log("Speech synthesis error:", event.error);
		};
		log("Starting speech synthesis...");
		this.synth.speak(utterance);
		log("Speech synthesis started.");
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
		log("Initializing HtmlSpeechSynthesisDisplayer...");
		this.document = document;
		this.elements = elements;
		log("Initializing speech manager...");
		this.speechManager = new SpeechSynthesisManager();
		log("Speech manager initialized.");
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
		this.languageSelect.addEventListener("change", this.updateVoices);
		this.voiceSelect.addEventListener("change", () => {
			this.speechManager.selectedVoiceIndex(this.voiceSelect.value);
			this.updateVoices();
		});
		this.rateInput.addEventListener("input", this.updateRate);
		this.pitchInput.addEventListener("input", this.updatePitch);

		this.updateVoices();
	}
	// Load available voices
	updateVoices() {
		//this.speechManager.setLanguage(this.languageSelect.value);

		// Populate voice dropdown
		this.voiceSelect.innerHTML = "";
		log("(HtmlSpeechSynthesisDisplayer) Voices cleared.");
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
			warn(
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
		log(
			"(HtmlSpeechSynthesisDisplayer) Updating speech synthesis display...",
		);
		log("currentAddress:", currentAddress);
		if (currentAddress) {
			this.updateVoices();
			var textToBeSpoken = "";
			textToBeSpoken += this.buildTextToSpeech(currentAddress);
			log("textToBeSpoken:", textToBeSpoken);
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
