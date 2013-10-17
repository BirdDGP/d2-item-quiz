;(function(){

    var scoreAddition = 200,
    	scoreMultiplier = 1.2,
    	totalCombo = 0,
    	totalScore = 0,
    	guessLeft = 3,
    	questionArchive = [],
    	htmlDataBindingName = 'data-d2quizchoice',
    	imgBaseUrl = 'http://cdn.dota2.com/apps/dota2/images/quiz/',
    	imgBaseUrlLocal = 'images/',
    	comboMsg = ['First Blood!', 'Double Kill!',
    		'Killing Spree!', 'Dominating!', 'Mega Kill!',
    		'Unstoppable!', 'Wicked Sick!', 'Monster Kill!',
    		'Godlike!', 'Holy Shit!'],
    	// Items to be excluded from the quiz
    	excludedItems = ["quelling_blade", "gem", "diffusal_blade_2", "aegis","cheese","recipe","courier","flying_courier","tpscroll","ward_observer","ward_sentry","bottle","necronomicon_2",
		"necronomicon_3","dagon_2","dagon_3","dagon_4","dagon_5","halloween_candy_corn","present","mystery_arrow","mystery_hook",
		"mystery_missile","mystery_toss","mystery_vacuum","winter_cake","winter_coco","winter_cookie","winter_greevil_chewy",
		"winter_greevil_garbage","winter_greevil_treat","winter_ham","winter_kringle","winter_mushroom","winter_skates",
		"winter_stocking","winter_band","greevil_whistle","greevil_whistle_toggle","halloween_rapier", "tango", "clarity"],

	itemObj = {
		materials: {},
		combined: {},
	},

	recipeStub = {
		"img":"recipe_lg.png",
		"dname":"Recipe",
		"qual":"component",
		"desc":"A recipe to build the desired item.",
		"cost":0,
		"attrib":"",
		"mc":0,
		"cd":0,
		"lore":"A recipe is always necessary to craft the most mighty of objects.",
		"components":null,
		"created":false
	};

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

	Question.prototype = {
		// Create 5 unique wrong items for users to pick.
		// Not a single item from those 5 can't be the same as correct answer.
		createWrongItems: function() {
			// Randomly select assembled/combined item
			var keysArr = [], i = 5, k=0,
			randomItemName = '';

			// randomItemName: String
			// Returns boolean.
			var isUniqueItem = function(randomItemName){
				// If the randomized item is already present in our question obj, repick randomized item.
				// Check if the wrongItems array already has that item.
				// if reversed is true, check combined item as wrong answers.
				// if reversed is false, check component items as wrong answers.
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
					randomItemName = keysArr[randomInt(0, keysArr.length - 1)];
				} while (!isUniqueItem.call(this, randomItemName)); // Don't forget to bind
				this.wrongItems.push(randomItemName);
			}

			return this;
		},

		// itemName (string)
		// Return this
		// adds an element to this.userAnswer array.
		addUserAnswer: function(itemName) {
			this.userAnswer.push(itemName);
			return this;
		},

		// itemName (string)
		// Return this
		// removes an element from this.userAnswer array.
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

		submitAnswer: function() {
			// Detect length of submitted user answer to invoke evaluateAnswer method.
			// If reversed, length of answer should be one.
			// If not, length of answer depends on number of materials + recipe if there's any.
			if (this.userAnswer.length + (this.userRecipe ? 1 : 0) >= this.answerLength) {
				this.evaluateAnswer(this.userAnswer);
			}
		},

		// userInput: Array
		// Sets this.correct as boolean.
		// Invoke function depending on whether the answer is right or wrong.
		evaluateAnswer: function(userInput) {

			console.log('evaluating...');
			// see if all materials are present in userAnswer's array.
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

			//If reversed is true, check combined item for answer.
			//If reversed is false, check component items for answer.

			if (this.reversed) {
				this.correct = (this.itemName === userInput[0]);
			} else {
				this.correct = this.materials.every(checkItem) && checkRecipe.call(this);
			}

			this.correct ? showNextQuestion() : resetSelections();
		},

	};

	function showNextQuestion(){
		addScore();
		generateQuestion();
		setupPage();
	}

	function addScore(){
		var doc = document,
		totalScoreSpan = doc.getElementById('totalScore'),
		totalComboSpan = doc.getElementById('totalCombo');

		// Add score based on the combo rate.
		totalScore += scoreAddition * scoreMultiplier;

		totalScoreSpan.innerText = totalScore;
		totalComboSpan.innerText = ++totalCombo;
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

	function initQuiz(item){
		populateItemObj(item);
		generateQuestion();
		setupPage();
		console.log(questionArchive);
	}

	// If the user inserts wrong answer, reset all selections.
	function resetSelections(){
		var doc = document,
		latestQuestion = questionArchive.slice(-1)[0],
		userAnswers = doc.getElementById('userAnswer').childNodes,
		recipeSpan = doc.getElementById('recipe'),
		guessLeftSpan = doc.getElementById('guessLeft'),
		totalComboSpan = doc.getElementById('totalCombo');

		// Reset user selection array and recipe in latest question.
		latestQuestion.userRecipe = false;
		latestQuestion.userAnswer = [];

		// Reset UI for item selections.
		recipeSpan.className = '';
		console.log(userAnswers);

		for (var i = 0; i < userAnswers.length; i++) {
			userAnswers[i].className = 'items';
		}

		totalCombo = 0;
		totalComboSpan.innerText = totalCombo;
		guessLeftSpan.innerText = --guessLeft;

		if (guessLeft === 0) alert('You lose!');
	}

	// Remove all elements.
	function removeAllChildren(){
		var doc = document,
		recipeDiv = doc.getElementById('recipe'),
		eleToEmpty = [doc.getElementById('combinedItem'), doc.getElementById('materialItems'), doc.getElementById('userAnswer')];

		eleToEmpty.forEach(function(ele){
			while (ele.firstChild) {
				ele.removeChild(ele.firstChild);
			}
		});
		recipeDiv.className = '';
	}

	// Add element with settings for multiple properties
	function addElement(name, properties) {
		var e = document.createElement(name);
		for (var p in properties) {
			e[p] = properties[p];
		}
		return e;
	}

	function getImageURL(itemName) {
		// If it's undefined, it's a recipe.
		if (typeof itemName === 'undefined') {
			return ('url(' + imgBaseUrlLocal  + 'recipe_lg.png\)');
		}

		for (var key in itemObj) {
			if (itemObj[key].hasOwnProperty(itemName)) {
				urlName = itemObj[key][itemName].img;
			}
		}

		if (typeof urlName === 'undefined') {
			throw "There's no image URL for " + itemName; 
		} else {
			return ('url(' + imgBaseUrlLocal  + urlName + '\)');
		}
		
	}

	function setupPage(){
		// Retrieve the latest question generated.
		var doc = document,
		latestQuestion = questionArchive.slice(-1)[0],
		materials = doc.getElementById('materialItems'),
		materialsFragment = doc.createDocumentFragment(),
		combined = doc.getElementById('combinedItem'),
		userAnswer = doc.getElementById('userAnswer'),
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
			newElement = addElement('div', {className: latestQuestion.reversed ? 'items' : 'items questionMark'});
			
			if (latestQuestion.reversed) {
				newElement.style.backgroundImage = getImageURL(latestQuestion.materials[i]);
			}

			materialsFragment.appendChild(newElement);
		}

		materials.appendChild(materialsFragment);

		newElement = addElement('div', {className: latestQuestion.reversed ? 'items questionMark' : 'items'});

		if (!latestQuestion.reversed) {
			newElement.style.backgroundImage = getImageURL(latestQuestion.itemName);
		}

		combined.appendChild(newElement);

		// Randomly assign wrong and correct answers.
		answers = latestQuestion.wrongItems.concat(latestQuestion.reversed ? latestQuestion.itemName : latestQuestion.materials);
		answers = shuffleArray(answers);

		for (var key in answers) {
			newElement = addElement('div', {className: 'items'});
			newElement.style.backgroundImage = getImageURL(answers[key]);
			newElement.setAttribute(htmlDataBindingName, answers[key]);

			(function(newElement){
				newElement.onclick = function(e){

					if (newElement.className === 'items') {
						newElement.className = 'items selected';
						latestQuestion.addUserAnswer(newElement.getAttribute(htmlDataBindingName)).submitAnswer();
					} else {
						newElement.className = 'items';
						latestQuestion.removeUserAnswer(newElement.getAttribute(htmlDataBindingName));
					}
					
					console.log(latestQuestion);

				};
			})(newElement); // closure for adding event listener to the elements in for loop.

			userAnswerFragment.appendChild(newElement);	
		}
		
		userAnswer.appendChild(userAnswerFragment);

		// Get rid of recipe from user choice depending on the question.
		recipeDiv.style.display = latestQuestion.reversed ? 'none' : 'inline-block';

		// this should only occur once ***************
		recipeDiv.onclick = function (e) {
			latestQuestion.userRecipe = latestQuestion.userRecipe ? false : true;
			recipeDiv.className = (recipeDiv.className === '' ? 'selected' : '');
			latestQuestion.submitAnswer()
			console.log(latestQuestion);
		}

	}

	// Selectively choose items that match the following requirements
	// 1. Non-Consumable Items
	// 2. Not Event Exclusive
	// 3. Not Upgraded Version of Items (ex. Dagon Lv 2, Necronomicon Lv 2, Diffusual Lv 2, etc) 

	function populateItemObj(item) {

		for (var propertyName in item.itemdata) {
			if (excludedItems.every(function(itemName){return itemName !== propertyName})){
				if (item.itemdata[propertyName]['qual'] !== "consumable") {
					if (!item.itemdata[propertyName].components) {
						itemObj.materials[propertyName] = item.itemdata[propertyName];
					} else {
						itemObj.combined[propertyName] = item.itemdata[propertyName];
					}
				}
			}
		}

	}

	// Randomly generate integer between min and max number. [Inclusive]
	function randomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1) + min); 
	}

	// Shuffle array elements and return new array.
	function shuffleArray(arr){
		var cache, index, counter = arr.length;
		while (counter--) {
			index = randomInt(0, counter);
			temp = arr[counter];
			arr[counter] = arr[index];
			arr[index] = temp;
		}
		return arr;
	}

	// Check if the sum of components matches with the total cost. If not, recipe is required.
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


	// Generate a question and store it in the question archive.
	function generateQuestion() {

		// Randomly select assembled/combined item
		var keysArr = [], 
		randomItemName = '',
		randomItemObj = {};

		keysArr = Object.keys(itemObj.combined);
		randomItemName = keysArr[randomInt(0, keysArr.length - 1)];
		randomItemObj = itemObj.combined[randomItemName];

		questionArchive.push(
			new Question({
				itemName: randomItemName,
				materials: randomItemObj.components,
				reversed: false, // Determine the quiz type
				recipe: getRecipe(randomItemObj.components, randomItemObj.cost),
			}).createWrongItems()
		);

	}

	retrieveItems({});

})();