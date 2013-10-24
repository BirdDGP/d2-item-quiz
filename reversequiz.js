;(function(){

    var doc = document, // Document alias for convenience.
    	SCORE_ADDITION = 200,
    	SCORE_MULTIPLIER = 1.2,
    	totalCombo = 0,
    	totalScore = 0,
    	guessLeft = 3,
    	questionArchive = [],

    	// Combo message to be shown in a notification upon submitting a correct answer consecutively.
    	COMBO_MESSAGE = ['First Blood!', 'Double Kill!',
    		'Killing Spree!', 'Dominating!', 'Mega Kill!',
    		'Unstoppable!', 'Wicked Sick!', 'Monster Kill!',
    		'Godlike!', 'Holy Shit!'],

    	// Wrong message to be shown in a notification upon submitting a wrong answer.
    	WRONG_MESSAGE = ['Ooops', 'Nope', 'Nuh-uh', 'Nah', 'Wrong', 'Think again'],

    	// HTML Data Binding Attribute Name.
    	htmlDataBindingName = 'data-d2quizchoice',

    	// Absolute path of image URL if the images are being loaded from Dota2 CDN.
    	imgBaseUrl = 'http://cdn.dota2.com/apps/dota2/images/quiz/',
    	
    	// Relative path to image directory if the images are being loaded locally.
    	imgBaseUrlLocal = 'images/',

    	// Items to be excluded from the quiz
    	excludedItems = ["quelling_blade", "gem", "diffusal_blade_2", "aegis","cheese","recipe","courier","flying_courier","tpscroll","ward_observer","ward_sentry","bottle","necronomicon_2",
		"necronomicon_3","dagon_2","dagon_3","dagon_4","dagon_5","halloween_candy_corn","present","mystery_arrow","mystery_hook",
		"mystery_missile","mystery_toss","mystery_vacuum","winter_cake","winter_coco","winter_cookie","winter_greevil_chewy",
		"winter_greevil_garbage","winter_greevil_treat","winter_ham","winter_kringle","winter_mushroom","winter_skates",
		"winter_stocking","winter_band","greevil_whistle","greevil_whistle_toggle","halloween_rapier", "tango", "clarity"],

	// Colors of the guesses left text given its number. (1 = red, 2 = yellow, 3 = white)
	guessLeftColors = ['red', 'yellow', 'white'],

	// Placeholder object for items.
	itemObj = {
		materials: {},
		combined: {},
	};

	/**
	* Constructor function for Question Class.
	*
	* @param {Object} settings
	* 
	* itemName {String} - Name of the combined item
	* materials {Array} - Array of strings consisting name of material items to synthesize a combined item.
	* reversed {Boolean} - Is this question reversed? (Ask user for either combined or material items?)
	* recipe {Number} || undefined - Does this combined item require a recipe to be synthesized? If so, how much is this recipe?
	* answerLength {Number} - Required length of user answer to trigger answer evaluation.
	* userAnswer {Array} - Array of strings consisting name of items user selected for this question.
	* userRecipe {Boolean} - Did user select recipe for answer?
	* correct {Boolean} || undefined - Was this question answered correctly when the evaluation method ran last time?
	*
	*/
	var Question = function(settings) {
		this.itemName = settings.itemName,
		this.materials = settings.materials,
		this.reversed = settings.reversed,
		this.recipe = settings.recipe,
		this.answerLength = (settings.reversed ? 1 : settings.materials.length + (settings.recipe ? 1 : 0)),
		this.wrongItems = [],
		this.userAnswer = [],
		this.userRecipe = false,
		this.correct = undefined
	};

	// Methods for Question Class.
	Question.prototype = {
		/**
		*
		* Create 5 unique wrong items for users to pick.
		* All of those 5 wrong items can NOT be the same as items in the correct answer.
		*
		* @return {Object} <---- this
		*
		*/
		createWrongItems: function() {
			var keysArr = [], i = 5, k=0,
			randomItemName = '';

			/**
			* Check if the randomly selected item name is unique. 
			*
			* @param {String} randomItemName
			* @return {Boolean}
			*
			*/
			var isUniqueItem = function(randomItemName){
				// If the randomized item is already present in our question obj, repick randomized item.
				// Check if the wrongItems array already has that item.
				// if reversed is true, compare combined item for wrong answers.
				// if reversed is false, compare component items for wrong answers.
				if (this.wrongItems.every(function(ele){
					return ele !== randomItemName;
				})){
					if (this.reversed) {
						return this.itemName !== randomItemName;
					} else {
						return this.materials.every(function(ele){return ele !== randomItemName});
					}
				}
				return false;
			}

			// If it's reversed quiz, select combined item for answer. Otherwise, materials.
			keysArr = this.reversed ? Object.keys(itemObj.combined): Object.keys(itemObj.materials);

			while (i--) {
				do {
					randomItemName = keysArr[Helper.randomInt(0, keysArr.length - 1)];
				} while (!isUniqueItem.call(this, randomItemName)); // Don't forget to bind 'this'
				this.wrongItems.push(randomItemName);
			}

			return this;
		},

		/**
		* Push given item name into the userAnswer array in this object.
		*
		* @param {String} itemName
		* @return {Object} <---- this
		*/
		addUserAnswer: function(itemName) {
			this.userAnswer.push(itemName);
			return this;
		},

		/**
		* Find and remove given item name from the userAnswer array in this object.
		*
		* @param {String} itemName
		* @return {Object} <---- this
		*/
		removeUserAnswer: function(itemName) {

			var i = this.userAnswer.length

			while (i--) {
				if (this.userAnswer[i] === itemName) {
					this.userAnswer.splice(i, 1); // take that specific item out of array.
					break; // break out of loop
				}
			};
			return this;

		},

		/**
		* Invoke evaluateAnswer method based on length of selected items by user.
		* If reversed, required length of answer should be one.
		* If not, required length of answer depends on number of materials + recipe if there's any.
		*/
		submitAnswer: function() {
			// 
			if (this.userAnswer.length + (this.userRecipe ? 1 : 0) >= this.answerLength) {
				this.evaluateAnswer(this.userAnswer);
			}
		},


		/**
		* Evaluate whether the user answer stored in this object is correct or not.
		* If correct, invoke function to show next question.
		* If incorrect, invoke function to reset all user selections.
		* This object's correct (boolean) will be set accordingly.
		*
		* @param {Array} userInput <--- this.userAnswer
		*/
		evaluateAnswer: function(userInput) {

			// see if all materials are present in userAnswer's array.
			// If at least one of those item exists, then it must be true.
			// To be used as callback function for every.
			var checkItem = function(element) {
				for (var i = userInput.length; i--;) {
					if (element === userInput[i]) return true;
				}
			}

			// see if user correctly identified that item requires recipe.
			var checkRecipe = function() {
				// Check if the this.recipe is number. If it is, recipe exists.
				// then compare it with this.userRecipe to see if user selected recipe.
				return ((typeof this.recipe === 'number') === this.userRecipe);
			}
			
			if (!(userInput instanceof Array)) {
				throw new Error('Expected array for evaluateAnswer, got: ' + userInput);
			}

			//If reversed is true, compare combined item for answer.
			//If reversed is false, compare component items for answer.

			if (this.reversed) {
				this.correct = (this.itemName === userInput[0]);
			} else {
				this.correct = this.materials.every(checkItem) && checkRecipe.call(this);
			}

			this.correct ? showNextQuestion() : resetSelections();
		},

	}

	var Helper = {
		/**
		* Create HTML element and add multiple properties with given object.
		*
		* @param {String} name
		* @param {Object} properties
		* @return {Node}
		*/
		addElement: function(name, properties) {
			var e = doc.createElement(name);
			for (var p in properties) {
				e[p] = properties[p];
			}
			return e;
		},

		/**
		* Randomly generate integer between min and max number. [Inclusive]
		*
		* @param {Number} min
		* @param {Number} max
		* @return {Number}
		*/
		randomInt: function (min, max) {
			return Math.floor(Math.random() * (max - min + 1) + min); 
		},

		/**
		* Shuffle array values inside array and return changed array.
		*
		* @param {Array} arr
		* @return {Array}
		*/
		shuffleArray: function (arr){
			var cache, index, counter = arr.length;
			while (counter--) {
				index = this.randomInt(0, counter);
				temp = arr[counter];
				arr[counter] = arr[index];
				arr[index] = temp;
			}
			return arr;
		},

		/**
		* Higher order function for adding all different prefixed event listener for CSS3 animation.
		*
		* @param {Node} element
		* @param {string} type
		* @param {function} callback
		*/
		prefixedEvent: function(element, type, callback) {
			var pfx = ["webkit", "moz", "MS", "o", ""];
			for (var p = 0; p < pfx.length; p++) {
				if (!pfx[p]) type = type.toLowerCase();
				element.addEventListener(pfx[p]+type, callback, false);
			}
		},
	}

	// Retrieve JSON of Dota2 in-game itemDB
	function retrieveItems(s){
		
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function() {
			// When the response data has been retrieved (status 4)
			if (xhr.readyState == 4) {
				// If the status code indicates that the response is available
				if ((xhr.status >= 200 && xhr.status < 300)  || xhr.status == 304) {
					initQuiz(JSON.parse(xhr.responseText)); // initialize quiz with the item data.
				} else {
					// if the status code indicates there's no response.
					throw 'AJAX request has failed.';
				}
			}
		}

		xhr.open('get', (s.url || 'itemDB.json'), true);
		xhr.send(null);

	}

	function attachEventOnce(){
		// Here are all DOM event listeners that should only be attached once on page load.
		var recipeDiv = doc.getElementById('recipe');
		
		Helper.prefixedEvent(doc.getElementById('messageHolder'), "AnimationEnd", function(e){
		     this.className = '';
		});

		recipeDiv.onclick = function (e) {
			var latestQuestion = questionArchive.slice(-1)[0];
			latestQuestion.userRecipe = !(latestQuestion.userRecipe);

			if (recipeDiv.className === '') {
				this.className = 'selected';
				addToBlank('recipe');
				latestQuestion.submitAnswer();
			} else {
				this.className = '';
				removeFromBlank('recipe');
			}
		}
	}

	/**
	* Show notification message with CSS3 animation.
	* If the user answer is correct, show combo message.
	* if the user answer is false, show incorrect message.
	*
	* @param {answerBoolean} itemName
	*/
	function showMessage(answerBoolean){
		var msgDiv = doc.getElementById('messageHolder'),
		     msgLen = COMBO_MESSAGE.length;

		     if (answerBoolean) {
		     	msgDiv.innerHTML = COMBO_MESSAGE[totalCombo-1] || COMBO_MESSAGE[msgLen-1]; 
		     } else {
		     	msgDiv.innerHTML = WRONG_MESSAGE[Helper.randomInt(0, WRONG_MESSAGE.length - 1)];
		     }

		     msgDiv.className = 'startMessage';		     
	}

	/**
	* Add and display the updated total score upon submitting correct answer.
	*/
	function addScore(){
		var totalScoreSpan = doc.getElementById('totalScore'),
		totalComboSpan = doc.getElementById('totalCombo');

		// Add score based on the combo rate.
		totalScore += SCORE_ADDITION * SCORE_MULTIPLIER;

		totalScoreSpan.innerText = totalScore;
		totalComboSpan.innerText = ++totalCombo;
	}

	/**
	* Remove all children elements from specified DOMs.
	*/
	function removeAllChildren(){
		var recipeDiv = doc.getElementById('recipe'),
		eleToEmpty = [doc.getElementById('combinedItem'), doc.getElementById('materialItems'), doc.getElementById('userAnswer')];

		eleToEmpty.forEach(function(ele){
			while (ele.firstChild) {
				ele.removeChild(ele.firstChild);
			}
		});
		recipeDiv.className = '';
	}

	/**
	* Reset all user selections upon submitting wrong answer.
	* If the remaining guess is 0, trigger game over.
	*/
	function resetSelections(){
		var latestQuestion = questionArchive.slice(-1)[0],
		userAnswers = doc.getElementById('userAnswer').childNodes,
		recipeSpan = doc.getElementById('recipe'),
		guessLeftSpan = doc.getElementById('guessLeft'),
		totalScoreSpan = doc.getElementById('totalScore'),
		totalComboSpan = doc.getElementById('totalCombo'),
		materialsDiv = doc.getElementById('materialItems'),
		combinedDiv = doc.getElementById('combinedItem');

		// Reset user selection array and recipe in latest question.
		latestQuestion.userRecipe = false;
		latestQuestion.userAnswer = [];

		// Reset UI for item selections.
		recipeSpan.className = '';

		for (var i = 0; i < userAnswers.length; i++) {
			userAnswers[i].className = 'items';
		}

		if (latestQuestion.reversed) {
			combinedDiv.firstChild.className = 'items questionMark';
			combinedDiv.firstChild.style.backgroundImage = '';
		} else {
			for (var i = 0, l = materialsDiv.childNodes.length; i < l; i++) {
				materialsDiv.childNodes[i].className = 'items questionMark';
				materialsDiv.childNodes[i].style.backgroundImage = '';
			}
		}

		totalCombo = 0;
		totalComboSpan.innerText = totalCombo;
		guessLeftSpan.innerText = --guessLeft;
		guessLeftSpan.parentNode.style.color = guessLeftColors[(guessLeft - 1)] || 'white';

		// When guess left reaches 0, trigger game over.
		if (guessLeft === 0) {
			totalScore = 0;
			totalScoreSpan.innerText = totalScore;
			guessLeft = 3;
			guessLeftSpan.innerText = guessLeft;
			alert('You lose!');
			generateQuestion();
			setupPage();
		} else {
			showMessage(false);
		}
	}

	/**
	* Get image URL of the appropriate item given its itemName.
	* By default stripURL will be false, but if it's true, return only the relative URL string excluding the background-image css format.
	*
	* @param {String} itemName
	* @param {Boolean} stripURL
	* @return {String}
	*/
	function getImageURL(itemName, stripURL) {

		var urlName;
		// stripURL should be false by default.
		if (typeof stripURL === 'undefined') stripURL = false;

		// If it's a recipe.
		if (itemName === 'recipe') {
			return stripURL ? imgBaseUrlLocal  + 'recipe_lg.png' : ('url(' + imgBaseUrlLocal  + 'recipe_lg.png\)');
		}

		for (var key in itemObj) {
			if (itemObj[key].hasOwnProperty(itemName)) {
				urlName = itemObj[key][itemName].img;
			}
		}

		if (typeof urlName === 'undefined') {
			throw "There's no image URL for " + itemName; 
		} else {
			return stripURL ? imgBaseUrlLocal  + urlName : ('url(' + imgBaseUrlLocal  + urlName + '\)');
		}
		
	}

	/**
	* Setup quiz page by first removing all associated elements within quiz holder,
	* then append all new html elements with event listener attached.
	*/
	function setupPage(){
		// Retrieve the latest question generated.
		var latestQuestion = questionArchive.slice(-1)[0],
		materials = doc.getElementById('materialItems'),
		materialsFragment = doc.createDocumentFragment(),
		combined = doc.getElementById('combinedItem'),
		userAnswerDiv = doc.getElementById('userAnswer'),
		recipeDiv = doc.getElementById('recipe'),
		userAnswerFragment = doc.createDocumentFragment(),
		newElement, answers = [];

		// If the question is not reversed, present it like default Dota 2 Quiz
		// Otherwise, users will guess the composite item instead. (remove recipe)

		removeAllChildren();

		// If recipe exists (given number, not null)
		// we must add recipe at the end.

		var maxLength = (typeof latestQuestion.recipe === 'number') ? 
		latestQuestion.materials.length + 1 : latestQuestion.materials.length;

		for (var i = 0; i < maxLength; i++) {
			newElement = Helper.addElement('div', {className: latestQuestion.reversed ? 'items' : 'items questionMark'});
			
			if (latestQuestion.reversed) {
				newElement.style.backgroundImage = getImageURL(latestQuestion.materials[i] || 'recipe');
			} else {
				(function(newElement){
					newElement.onclick = function(e){
						if (newElement.className !== 'items questionMark') {
							latestQuestion.removeUserAnswer(newElement.getAttribute(htmlDataBindingName));
							removeFromBlank(newElement.getAttribute(htmlDataBindingName));
						}
					}
				})(newElement);
			}

			materialsFragment.appendChild(newElement);
		}
		materials.appendChild(materialsFragment);


		newElement = Helper.addElement('div', {className: latestQuestion.reversed ? 'items questionMark' : 'items'});
		if (!latestQuestion.reversed) {
			newElement.style.backgroundImage = getImageURL(latestQuestion.itemName);
		}
		combined.appendChild(newElement);

		// Randomly assign wrong and correct answers.
		answers = latestQuestion.wrongItems.concat(latestQuestion.reversed ? latestQuestion.itemName : latestQuestion.materials);
		answers = Helper.shuffleArray(answers);

		for (var key in answers) {
			newElement = Helper.addElement('div', {className: 'items'});
			newElement.style.backgroundImage = getImageURL(answers[key]);
			newElement.setAttribute(htmlDataBindingName, answers[key]);

			// assign onclick event listener to each items for users to choose.
			(function(newElement){
				newElement.onclick = function(e){
					if (newElement.className === 'items') {
						newElement.className = 'items selected';
						addToBlank(newElement.getAttribute(htmlDataBindingName));
						latestQuestion.addUserAnswer(newElement.getAttribute(htmlDataBindingName)).submitAnswer();
					} else {
						newElement.className = 'items';
						removeFromBlank(newElement.getAttribute(htmlDataBindingName));
						latestQuestion.removeUserAnswer(newElement.getAttribute(htmlDataBindingName));
					}
				};
			})(newElement); // closure for adding event listener to the elements in for loop.

			userAnswerFragment.appendChild(newElement);	
		}
		
		userAnswer.appendChild(userAnswerFragment);

		// Get rid of recipe from user choice depending on the question.
		recipeDiv.style.display = latestQuestion.reversed ? 'none' : 'inline-block';
	}

	/**
	* Add selected item icon into the user answer placeholder box by manipulating style, html data binding, and class name.
	*
	* @param {string} itemName
	*
	*/
	function addToBlank(itemName) {
		// fill in question mark with item by finding appropriate item icon given from itemName string.
		var latestQuestion = questionArchive.slice(-1)[0],
		materialsDiv = doc.getElementById('materialItems'),
		combinedDiv = doc.getElementById('combinedItem'),
		mChildren = materialsDiv.childNodes;

		// check if the question mark icon exists
		var isQuestionMark = function(ele) {
			return ele.className === 'items questionMark';
		}

		if (latestQuestion.reversed) {
			combinedDiv.firstChild.className += ' chosen'
			combinedDiv.firstChild.style.backgroundImage = getImageURL(itemName);
		} else {
			for (var i = 0, l = mChildren.length; i < l; i++) {
				if (isQuestionMark(mChildren[i])) {
					mChildren[i].className += ' chosen';
					mChildren[i].style.backgroundImage = getImageURL(itemName);
					mChildren[i].setAttribute(htmlDataBindingName, itemName);
					break;
				}
			}
		}
	}

	/**
	* Remove selected item icon from the user answer placeholder box by manipulating style, html data binding and class name.
	*
	* @param {string} itemName
	*
	*/
	function removeFromBlank(itemName) {

		// fill in question mark with item by finding appropriate item icon given from itemName string.
		var latestQuestion = questionArchive.slice(-1)[0],
		materialsDiv = doc.getElementById('materialItems'),
		userAnswerDiv = doc.getElementById('userAnswer'),
		recipeDiv = doc.getElementById('recipe'),
		mChildren = materialsDiv.childNodes,
		uaChildren = userAnswerDiv.childNodes;

		// check if the question mark icon exists
		var isQuestionMark = function(ele) {
			return ele.className === 'items questionMark';
		},

		deselectItem = function(itemName) {
			if (itemName === 'recipe') {
				//undefined itemName represents recipe.
				if (recipeDiv.className === 'selected') {
					recipeDiv.className = '';
					latestQuestion.userRecipe = false;
				}
			} else {
				for (var i = 0, l = uaChildren.length; i < l; i++) {
					if (uaChildren[i].getAttribute(htmlDataBindingName) === itemName && uaChildren[i].className === 'items selected') {
						uaChildren[i].className = 'items';
						break;
					}
				}
			}
		}

		for (var i = 0, l = mChildren.length; i < l; i++) {			
			if (mChildren[i].getAttribute(htmlDataBindingName) === itemName) {
				deselectItem(itemName); // doesn't need to be called if the item is clicked from selected state.
				mChildren[i].className = 'items questionMark';
				mChildren[i].style.backgroundImage = '';
				mChildren[i].setAttribute(htmlDataBindingName, '');
			// If removeFromBlank is triggered via selecting the item off from material list, manually turn the item selection off.
				break;
			}
		}
	}

	/**
	* Selectively choose items that match the following requirements:
	* 1. Non-Consumable Items
	* 2. Non-Event Exclusive Items
	* 3. Non-Upgraded Version of Items (ex. Dagon Lv 2, Necronomicon Lv 2, Diffusual Lv 2, etc)
	* Then sort the items by pushing them into itemObj in two different categories: combined or materials.
	*
	* @param {Object} items
	*/
	function populateItemObj(items) {
		for (var propertyName in items.itemdata) {
			if (excludedItems.every(function(itemName){return itemName !== propertyName})){
				if (items.itemdata[propertyName]['qual'] !== "consumable") {
					if (!items.itemdata[propertyName].components) {
						itemObj.materials[propertyName] = items.itemdata[propertyName];
					} else {
						itemObj.combined[propertyName] = items.itemdata[propertyName];
					}
				}
			}
		}
	}

	/**
	* Check if the sum of components matches with the total cost. 
	* If not, it implies the remaining cost belongs to the recipe. Therefore, recipe is required.
	*
	* @param {Number} totalCost 
	* @param {Array} compArr
	* @return {Number} || undefined;
	*/
	function getRecipe(compArr, totalCost){

		// Note that some component items themselves are combined items
		// (ex. Drum of Endurance has Bracer. Bracer itself is combined item.)
		var compTotal = 0;

		compArr.forEach(function(itemName){
			if (itemObj.materials.hasOwnProperty(itemName)) {
				compTotal += itemObj.materials[itemName].cost;  
			} else if (itemObj.combined.hasOwnProperty(itemName)) {
				compTotal += itemObj.combined[itemName].cost;
			}
			
		});

		return (compTotal === parseInt(totalCost)) ? undefined : (totalCost - compTotal); 
	}


	/**
	* Generate a question and push it into question archive.
	* Then generate a wrong set of items for users to choose.
	*/
	function generateQuestion() {
		// Randomly select assembled/combined item
		var keysArr = [], 
		randomItemName = '',
		randomItemObj = {};

		keysArr = Object.keys(itemObj.combined);
		randomItemName = keysArr[Helper.randomInt(0, keysArr.length - 1)];
		randomItemObj = itemObj.combined[randomItemName];

		questionArchive.push(
			new Question({
				itemName: randomItemName,
				materials: randomItemObj.components,
				reversed: (Helper.randomInt(0, 1) === 0), // Determine the quiz type
				recipe: getRecipe(randomItemObj.components, randomItemObj.cost),
			}).createWrongItems() // Create wrong set of items and store it in question object.
		);

	}

	function initQuiz(item){
		populateItemObj(item);
		generateQuestion();
		setupPage();
		attachEventOnce();
	}

	function showNextQuestion(){
		addScore();
		showMessage(true);
		generateQuestion();
		setupPage();
	}

	retrieveItems({});

})();