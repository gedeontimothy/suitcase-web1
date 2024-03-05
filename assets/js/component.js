function preg_quote(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
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
function mustache(text, datas, regexp, cl, def_val, func){
	regexp = regexp ?? /\{\{([^}]+)\}\}/g, error = false;
	let replaceCall = (match, key) => {
		key = (key.trim()).replace(new RegExp(preg_quote('\\:'), 'g'), () => '#![]9&!');
		let key_sep = key.split(':'), key_ = key_sep[0], default_value = key_sep[1] ?? def_val;
		if(func === false) default_value = key_sep[1] ? key_sep.splice(1).join(':') : def_val;
		if(datas.hasOwnProperty(key_) || (default_value || default_value === "")){
			let val = datas[key_] ?? default_value;
			if(key_sep[2] && (func === undefined || func === true)){
				var t = key_sep[2].match(/^([a-z])\|/i);
				if(t && t.length == 2){
					// alert('ss')
					if(t[1] == 'i'){
						const regex = new RegExp(preg_quote('['+key_+']'), 'g');
						const code = (key_sep[2].replace(/^[a-z]\|/i, '')).replace(regex, (m, k) => 'datas["' + key_ + '"]');
						try{
							var resp;
							eval('resp = ' + code + ' ? true : false;');
							if(resp) return cl && cl.key_result_done_callback ? cl.key_result_done_callback(val, match, key_, key_sep, default_value, [t[1], resp]) : val;
						}
						catch(error){
							cl.addError(error);
							console.error(match, error);
						}
					}
				}
				else console.error([match, key_sep[2], datas, text]);
				return '';
			}
			else return cl && cl.key_result_done_callback ? cl.key_result_done_callback(val, match, key_, key_sep, default_value) : val;
		}
		else{
			console.error("L'élément `" + key_ + "` n'a pas été trouvé parmis les données ", datas)
			cl.addError(["L'élément `" + key_ + "` n'a pas été trouvé parmis les données ", datas]);
			error = true;
		}
		return match;
	};
	let val = text.replace(regexp, replaceCall).replace(new RegExp(preg_quote('#![]9&!'), 'g'), () => ':');
	return error ? false : val;
}
class Component{
	file;
	tentative = 4;
	response;
	datas;
	error = [];
	element;
	url;

	cache = true;
	link_generated = false;
	style_generated = false;
	script_generated = false;

	link_element = [];
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
								this.generateLink();
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
						this.error.push(error);
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

	generateLink(){
		if(!this.link_generated && this.link_element.length > 0) {
			for (var st_el of this.link_element)
				document.head.appendChild(st_el);
			this.link_generated = true;
		}
	}

	generate(){
		if(!this.errorExists()){
			let dom_elements = getHtml(this.getMustacheDatas()), dom_element;
			for(let element_0 of dom_elements){
				if(element_0.tagName == 'LINK') this.link_element.push(element_0);
				else if(element_0.tagName == 'STYLE') this.style_element.push(element_0);
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

	key_result_done_callback(val, match, key, key_sep, default_value, condition){
		return condition ? (condition[0] == 'i' ? (condition[1] ? default_value : '') : val) : val;
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
					// datas = JSON.parse(el.innerHTML);
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
			
			let dts = mustache(this.datas, slots, /\@\[\-\-([^\]]+)\-\-\]/g, this, "", false);

			if(val = mustache(dts, datas, null, this)){
				return val;
			}
			else throw new Error();
		}
		catch(error){
			console.error("\tErreur Composant : " + this.url, this.datas, error);
		}
		return this.datas;
	}
	getResponse(){ return this.response; }

	getError(){ return this.error; }
	addError(error){ this.error.push(error); }
	errorExists(){ return this.error.length > 0 ? true : false; }
}

async function loadComponent(){

	var all_components = document.querySelectorAll('[c-file]');

	for (let element of all_components) {

		var component = new Component(element, element.getAttribute('c-file'));

		await component.exec();

		if(component.errorExists()){
			console.error(component.getError());
			// console.log(element.parentNode)
			element.innerHTML = '<div class="tw-inline-block tw-bg-red-400 tw-px-4 tw-py-2 ff-jost-medium tw-rounded-md">Un problème sur l\'appel du composant : ' + element.getAttribute('c-file') + '</div>';
			element.removeAttribute('c-file');
			// console.error('Composant : ');
			// console.error(component.getError());
			// element.remove();
			continue;
		}
		else {

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
	}

	for(let key in Component.all_components) {
		Component.all_components[key].generate();
	}

}
if(window.location.origin != "null") {

	document.addEventListener('DOMContentLoaded', async () => {
		var t = 0;
		while(document.querySelectorAll('[c-file]').length > 0){
			await loadComponent();
		}
	});

}