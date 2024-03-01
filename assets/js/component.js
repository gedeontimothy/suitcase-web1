function getHtml(str, first, attributes) {
	var res = document.createElement('div');
	if((typeof str) == 'string')
		res.innerHTML = str;
	else res.appendChild(str);
	return first === true ? ((el, attributes) => {
		if(attributes){
			for(let key in attributes) el.setAttribute(key, attributes[key]);
		}
		return el;
	})(res.firstChild, attributes) : res.children;
}
function mustache(text, datas, regexp, key_result_done_callback, def_val){
	regexp = regexp ?? /\{\{([^}]+)\}\}/g, error = false;
	let replaceCall = (match, key) => {
		key = key.trim();
		let key_sep = key.split(':'), key_ = key_sep[0], default_value = key_sep[1] ?? def_val;
		if(datas.hasOwnProperty(key_) || (default_value || def_val === "")){
			let val = datas[key_] ?? default_value;
			return key_result_done_callback ? key_result_done_callback(val, match, key_, key_sep, default_value) : val;
		}
		else{
			console.error("L'élément `" + key_ + "` n'a pas été trouvé parmis les données ", datas)
			error = true;
		}
		return match;
	};
	let val = text.replace(regexp, replaceCall);
	return error ? false : val;
}
class Component{
	file;
	tentative = 4;
	response;
	datas;
	error;
	element;
	url;

	cache = true;
	style_generated = false;
	script_generated = false;

	style_element = [];
	script_text = [];
	dom_element;
	static all_components = {};
	
	constructor(element, file){
		this.element = element;
		// console.log(element)
		this.file = file;
		this.url = (window.location.origin != "null" ? (window.location.origin + '/') : '') + this.file;
	}
	
	getFile(){ return this.file; }
	
	async exec(callback){
		let tentative = this.tentative;
		if(this.file){

			if(this.cache && Component.all_components[this.url]){
				this.datas = Component.all_components[this.url].data;
				this.response = Component.all_components[this.url].response;
			}
			else{
				for (var i = 0; i < tentative; i++) {
					await fetch(this.url, { headers : { 'Accept' : 'text/html' } })
					.then(response => {
						this.response = response;
						// console.log(response)
						if(response.status != 200) throw new Error('HTTP ' + response.statusText + ' ' + response.status);
						
						Component.all_components[this.url] = {'response' : response, generate: (key) => {
							if(key && (!(Component.all_components[key]) || !(Component.all_components[key]['generated']))){
								Component.all_components[key] = {...Component.all_components[key], 'generated' : true};
								this.generateStyle();
								this.generateScript();
							}
						}};
						return response.text();
					})
					.then(data => {
						// alert('once')
						this.datas = data;
						Component.all_components[this.url] = {...Component.all_components[this.url], 'data' : data};
					})
					.catch(error => {
						this.datas = null;
						this.error = error;
					});
					if(this.datas !== undefined) break;
				}
			}
		}
	}
	_generateAttributes(dom_element){
		// for(let class_ of this.element['classList']){
		// 	if(!dom_element.classList.contains(class_))
		// 		dom_element.classList.add(class_);
		// }
		for(let attr of this.element.attributes)
			if(!["c-file", "id", "class", "c-wait", "c-multiple"].includes(attr.name))
				dom_element.setAttribute(attr.name, attr.value)
			else if(attr.name == 'class'){
				// for(let class_ of attr.ownerElement['classList']){
				for(let class_ of this.element['classList']){
					if(!dom_element.classList.contains(class_))
						dom_element.classList.add(class_);
				}
			}
			else if(attr.name == 'id' && this.element.id != "") dom_element.id = this.element.id;
		return dom_element;
	}
	generateScript(){
		if(!this.script_generated && this.script_text.length > 0){
			for (var script_text of this.script_text){
				let script_element = document.createElement('script');
				script_element.textContent = script_text;
				document.head.appendChild(script_element)
			}
			this.script_generated = true;
		}		
	}

	generateStyle(){
		if(!this.style_generated && this.style_element.length > 0) {
			for (var st_el of this.style_element)
				document.head.appendChild(st_el);
			this.style_generated = true;
		}
	}

	generate(){
		if(!this.errorExists()){
			let dom_elements = getHtml(this.getMustacheDatas()), dom_element;
			for(let element_0 of dom_elements){
				if(element_0.tagName == 'STYLE') this.style_element.push(element_0);
				else if(element_0.tagName == 'SCRIPT') this.script_text.push(element_0.textContent);
				else dom_element = element_0;
			}

			this.dom_element = this._generateAttributes(dom_element);

			// this.generateStyle(style_element);
			// this.generateScript(script_text);

			this.element.replaceWith(this.dom_element);
		}
		else console.error(this.getError());
	}

	key_result_done_callback(val, match, key, key_sep, default_value){
		return val;
	}
	
	getResult(){ return this.result; }
	getDatas(){ return this.datas; }
	getDatasElement(){
		let datas = {}, attr = this.element.getAttribute('datas');
		if(attr != null && attr != ''){
			datas = JSON.parse(attr);
		}
		else{
			for(var el of this.element.children){
				if(el.id && el.id == "datas")
					datas = JSON.parse(el.textContent);
			}
		}
		return datas;
	}
	getSlotsElement(){
		let datas = {}, val;
		for(var el of this.element.children){
			if((val = el.getAttribute('c-slot')) !== null){
				if(val == "") datas['default'] = el.outerHTML;
				else datas[val] = el.innerHTML.trim();
			// 	datas = JSON.parse(el.textContent);
			}
		}
		return datas;
	}
	getMustacheDatas(){
		try{
			let datas = this.getDatasElement(), val, slots = this.getSlotsElement();
			
			let dts = mustache(this.datas, slots, /\@\{([^}]+)\}/g, null, "");

			if(val = mustache(dts, datas, null, this.key_result_done_callback)){
				return val;
			}
			else throw new Error();
		}
		catch(error){
			console.error("\tErreur Composant : " + this.url, datas, error);
		}
		return this.datas;
	}
	getResponse(){ return this.response; }

	getError(){ return this.error; }
	errorExists(){ return this.error ? true : false; }
}


if(window.location.origin != "null") {

	document.addEventListener('DOMContentLoaded', async () => {


		var all_components = document.querySelectorAll('[c-file]');

		for (let element of all_components) {

			var component = new Component(element, element.getAttribute('c-file'));

			await component.exec();

			let multiple = element.getAttribute('c-multiple') && Object.keys(component.getDatasElement()).length > 0 ? element.getAttribute('c-multiple') : false;
			if(multiple){
				multiple = JSON.parse(multiple);
				var parent = getHtml(document.createElement(multiple.type), true, multiple.attr);
				for(let v of component.getDatasElement()){
					let cloneElement = element.cloneNode(true)
					for(let el of cloneElement.children){
						if(el.id == 'datas')
							el.innerHTML = JSON.stringify(v);
					}
					var component_ = new Component(cloneElement, multiple.file ?? cloneElement.getAttribute('c-file'));
					await component_.exec();
					// cloneElement.
					component_.generate();
					parent.appendChild(component_.dom_element);

					if(!Component.all_components[component_.url].generated)
						Component.all_components[component_.url].generate(component_.url);
				}
				element.replaceWith(parent);
			}
			else component.generate();
			
			if(!Component.all_components[component.url].generated)
				Component.all_components[component.url].generate(component.url);

			// component.generateStyle();
			// component.generateScript();

		}

		for(let key in Component.all_components) {
			Component.all_components[key].generate();
		}

	});

}