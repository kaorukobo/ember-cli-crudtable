import Ember from 'ember';
import modal from './modal';
import ComplexModel from '../privateclasses/complexmodel';
const exportData = function(component, format, joinchar) {
	let data = [];
	let row = [];
	component.labels.forEach(function(field) {
		row.push(field.Display);
	});
	data.push(row);
	component.get('ComplexModel').forEach(function(model) {
		row = [];
		model.forEach(function(field) {
			row.push(field.Value);
		});
		data.push(row);
	});
	let content = "data:text/" + format + ";charset=utf-8,";
	data.forEach(function(infoArray, index) {
		let dataString = infoArray.join(joinchar);
		content += index < data.length ? dataString + "\n" : dataString;
	});
	content = encodeURI(content);
	let link = document.createElement("a");
	link.setAttribute("href", content);
	link.setAttribute("download", component.get('paginator').get('name') + "." + format);
	component.set('dlf', content);
	let download = link.click !== null;
	if (link.click) {
		link.click();
	}
}
const validatefilterset = function(filterset) {
	let valid = true;
	filterset.forEach((filter) => {
		valid = valid && filter.get('Key') !== null && filter.get('Condition') !== null && filter.get('Value') !== null;
	});
	return valid;
}

function makeRequest(component, query, done, fail) {
	let deferred = Ember.RSVP.defer('crud-table#createRecord');
	component.set('isLoading', true);
	component.sendAction('searchRecord', query, deferred);
	_getRequest(component, deferred);
	return deferred;
};

function metadata(component, records) {
	let meta = records.get("meta");
	if (meta !== undefined) {
		component.get('paginator').update(component, records.get("meta"), records.get('length'));
		component.get('paginator').generateLinks();
	}
};

function _getRequest(component, deferred, done, fail) {
	deferred.promise.then(function(records) {
			component.set("_table", records.type.modelName);
			metadata(component, records);
			component.set('value', records);
			ComplexModel.update(component);
			component.set('isLoading', false);
			if (done) {
				done();
			}
		},
		function(data) {
			component.set('isLoading', false);
			if (fail) {
				fail();
			}
		});
};
export default {
	actions: Ember.Object.create({
		internal_filterset() {
			this.filterset.init();
			this.set('filtercreation', true);
		},
		CloseFilterSet(result) {
			if (result) {
				if (this.filterset.savecallback !== undefined) {
					let filterset=this.filterset.filtergroups.content.map((filtergroup)=>{
						return {
							link:filtergroup.Link,
							filters:filtergroup.content.map((filter)=>{
								return {
									key:filter.Key,
									display : filter.Display,
									condition:filter.Condition,
									value:filter.Value,
									valuemask:filter.ValueMask,
									link:filter.Link
								};
							})
						};
					});
					result = !this.filterset.savecallback.bind(this.get('parent'))(filterset,this.filterset.filtergroups.get('areValid'));
				}
			}
			this.set('filtercreation',result);
		},
		AddFilter(filtergroup) {
			let count = filtergroup.get('length');
			if (filtergroup.get('length') > 0) {
				filtergroup.objectAt(filtergroup.get('length') - 1).set('Link', 'or');
			}
			filtergroup.addObject(this.filterset.create());
		},
		RemoveFilter(filtergroup, filter) {
			filtergroup.removeObject(filter);
			let prevfilter = filtergroup.objectAt(filtergroup.get('length') - 1);
			if (prevfilter) {
				prevfilter.set('Link', '');
			}
		},
		SwitchLocale(filter) {
			filter.set('Link', filter.Link === 'or' ? 'and' : 'or');
		},
		AddFilterGroup() {
			this.filterset.AddFilterGroup();
		},
		RemoveFilterGroup(filtergroup) {
			this.filterset.filtergroups.removeObject(filtergroup);
		},
		SelectFilterProperty(filter, property) {
			let selectobject = false;
			filter.set('Key', this.labels[property].Key);
			filter.set('Type', this.labels[property].Type);
			let type = this.fields[property].Type.split(":")[0];

			filter.set('Options', this.filterset[this.labels[property].Type]);
			filter.set('Display', this.labels[property].Display);
			switch (type) {
              case "ref.search":
                	filter.set('Key',this.fields[property].SearchValue);
                	filter.set('Options', this.filterset.text);
                break
				case 'number':
				case 'text':
					break;
				case 'many-multi':
				case 'belongsto':
				case 'powerselect':
					selectobject = {};
					this.dependants[this.fields[property].Source].forEach((element) => {
						selectobject[element.id] = element.get(this.fields[property].Display);
					});
					//filter.set('Key',this.fields[property].Source + '.' + this.fields[property].Display);
					break;
			}
			filter.set('SelectObject', selectobject);
		},
		SelectFilterValue(filter, target) {
			filter.set('Value', target.value);
			filter.set('ValueMask', target.selectedOptions[0].innerText);
		},
		SelectFilterConditon(filter, value) {
			filter.set('Condition', value);
		},
		select(record) {
			this.set('currentRecord', record);
		},
		generic_callback() {
			this.set('Callback', arguments[0]);
			delete arguments[0];
			let args = ['Callback', this.get('currentRecord')].concat([].slice.call(arguments));
			this.sendAction.apply(this, args);
			this.set('Callback', null);
		},
		internal_choose(incomming) {
			this.set('Callback', incomming);
			this.sendAction('Callback', this.get('currentRecord'));
			this.set('Callback', null);
		},
		toJSONObject() {
			let data = [];
			this.get('ComplexModel').forEach(function(model) {
				let row = {};
				model.forEach(function(field) {
					switch (field.Type) {
						case 'many-multi':
							row[field.Field] = [];
							field.Display.forEach(function(info) {
								if (info.Added) {
									row[field.Field].push(info.Routed.id * 1);
								}
							});
							break;
						default:
							row[field.Field] = field.Value;
							break;
					}
				});
				data.push(row);
			});
			let csvContent = "data:text/json;charset=utf-8," + JSON.stringify(data);
			let encodedUri = encodeURI(csvContent);
			let link = document.createElement("a");
			link.setAttribute("href", encodedUri);
			link.setAttribute("download", this.get("_table") + ".json");
			this.set('dlf', csvContent);
			if (link.click) {
				link.click();
			}
		},
		toTSV() {
			exportData(this, "tsv", "\t");
		},
		toCSV() {
			exportData(this, "csv", ",");
		},
		toSQL() {
			let component = this;
			let data = [];
			this.get('ComplexModel').forEach(function(model) {
				let columns = [];
				let values = [];
				model.forEach(function(field) {
					if (field.Type !== 'many-multi') {
						columns.push(field.Field);
						values.push(field.Value);
					}
				});
				data.push("INSERT INTO " + component.get('_table') + "(" + columns.join(",") + ") VALUES('" + values.join("','") + "')");
			});
			let sqlString = "data:text/sql;charset=utf-8," + data.join("\n");
			let encodedUri = encodeURI(sqlString);
			let link = document.createElement("a");
			link.setAttribute("href", encodedUri);
			link.setAttribute("download", this.get('_table') + ".sql");
			component.set('dlf', sqlString);
			if (link.click) {
				link.click();
			}
		},
		goto(page) {
			if (page > 0 && this.get('paginator').get('current') !== page) {
				this.get('paginator').getBody(page, this.lastquery);
				this.get('filterset').getBody(this.lastquery);
				makeRequest(this, this.lastquery);
			}
		},
		internal_cancel() {
			this.set('notEdition', true);
			this.set('isEdition', false);
		},
		internal_search() {
			let component = this;
			let field = $("#SearchField").val();
			Object.keys(component.fields).forEach(function(fieldname) {
				if (component.fields[fieldname].Label === field) {
					let type = component.fields[fieldname].Type.split(":")[0];
					switch (type) {
						case "powerselect":
							field = `${fieldname}.${component.fields[fieldname].Display}`;
							break;
						case "ref.search":
							field = component.fields[fieldname].SearchValue;
							break;
						default:
							field = fieldname;
							break;
					}

				}
			});
			let query = {};
			component.get('paginator').getBody(1, query);
			query[field] = component.get('SearchTerm');
			if (query[field] === "") {
				delete query[field];
			}
			this.lastquery = query;
			this.get('filterset').getBody(this.lastquery);
			makeRequest(component, this.lastquery);
		},
		confirm() {
			let validate = function() {
				try {
					return document.querySelector("#crudatable-update-data").checkValidity();
				} catch (e) {
					return !!window.callPhantom;;
				}
			};
			let component = this;
			let deferred;
			this.set('isLoading', true);
			if (component.get('newRecord')) {
				deferred = Ember.RSVP.defer('crud-table#createRecord');
				if (validate()) {
					component.sendAction('createRecord', component.get('currentRecord').RoutedRecord, deferred);
				} else {
					$("#crudatable-update-data-submit").click();
					deferred.reject(false);
				}
			} else if (component.get('showMap')) {
				let record = component.get('currentRecord');
				let map;
				let RoutedPropMap;
				record.forEach(function(prop) {
					RoutedPropMap = prop;
					switch (prop.Type) {
						case 'googlemap':
							map = record.get('map').getCenter();
							prop.set('Value', map.toUrlValue());
							break;
						case 'many-multi':
							break;
					}
				});
				deferred = Ember.RSVP.defer('crud-table#updateRecord');
				let geocoder = new google.maps.Geocoder();
				geocoder.geocode({
					'latLng': map
				}, function(results, status) {
					if (status === google.maps.GeocoderStatus.OK) {
						if (results[0]) {
							let add = results[0].formatted_address;
							let use = prompt('Suggested address is:\n' + add + '\n If you want to use it leave the field empty.');
							if (use === null || use === "") {
								record.RoutedRecord.set(RoutedPropMap.DisplayField, add);
							} else {
								record.RoutedRecord.set(RoutedPropMap.DisplayField, use);
							}
							record.RoutedRecord.set(RoutedPropMap.Zoom.field, record.get('map').getZoom());
						} else {
							console.warn("address not found");
						}
					} else {
						console.warn("Geocoder failed due to: " + status);
					}
					component.sendAction('updateRecord', record.RoutedRecord, deferred);
				});
			} else {
				let action = component.get('isDeleting') ? 'deleteRecord' : 'updateRecord';
				deferred = Ember.RSVP.defer(`crud-table#${action}`);
				if (validate() || action === "deleteRecord") {
					component.sendAction(action, component.get('currentRecord').RoutedRecord, deferred);
				} else {
					$("#crudatable-update-data-submit").click();
					deferred.reject(false);
				}
			}
			let updateview = Ember.RSVP.defer('crud-table#pagination');
			deferred.promise.then(function() {
				if (component.get('paginator') !== undefined) {
					let paginator = component.get('paginator');
					paginator.getBody(paginator.get('current'), component.lastquery);
					component.get('filterset').getBody(component.lastquery);
				} else {
					delete component.lastquery.page;
				}
				component.sendAction('searchRecord', component.lastquery, updateview);
			}, function() {
				component.set('isEdition', false);
				component.set('notEdition', true);
				component.set('isLoading', false);
			});
			_getRequest(component, updateview, function() {
				modal.hide();
				component.set('isEdition', false);
				component.set('notEdition', true);
			}, function() {
				modal.hide();
				component.set('isEdition', false);
				component.set('notEdition', true);
			})
		},
		internal_order(label) {
			this.get('labels').forEach(function(lbl) {
				if (label !== lbl) {
					Ember.set(lbl, 'Order_ASC', false);
					Ember.set(lbl, 'Order_DESC', false);
					Ember.set(lbl, 'Order', 0);
				}
			});
			Ember.set(label, 'Order_ASC', Ember.get(label, 'Order_DESC'));
			Ember.set(label, 'Order_DESC', !Ember.get(label, 'Order_DESC'));
			Ember.set(label, 'Order', Ember.get(label, 'Order_DESC') ? 1 : 2);
			this.get('paginator').sortData(label, this.lastquery);
			makeRequest(this, this.lastquery);

		},
		internal_map(record, kind) {

			if (google === undefined) {
				return;
			}
			let component = this;
			component.set('showMap', true);
			component.set('isLoading', true);
			modal.show();

			function mapit(id, latlng) {
				if (document.getElementById(id) === null) {
					return false;
				}
				let mapOptions = {
					zoom: latlng.zoom,
					center: latlng,
					mapTypeId: google.maps.MapTypeId.ROADMAP
				};
				let map = new google.maps.Map(document.getElementById(id), mapOptions);
				record.set('map', map);
				component.set('isLoading', false);
				return true;
			}

			let cord = "";
			record.forEach(function(prop) {
				if (prop.Type === kind) {
					cord = (prop.Value || '20.677632,-101.341632').split(',');
					cord = {
						lat: parseFloat(cord[0], 10),
						lng: parseFloat(cord[1], 10),
						zoom: prop.Zoom.value || 11
					};
				}
			});

			let waitforgoogle = function(fn) {
				if (google === undefined) {
					setTimeout(function() {
						fn(fn);
					}, 10);
					return false;
				}
				if (mapit('google_map_canvas', cord)) {
					setTimeout(function() {
						component.set('currentRecord', record);
					}, 1);
				} else {
					setTimeout(function() {
						fn(fn);
					}, 10);
				}
			};
			setTimeout(function(){
				waitforgoogle(waitforgoogle);
			},1000);

		},
		internal_create() {
			let component = this;
			let records = component.get('value').get('isLoaded') === true ? component.get('value') : component.get('value').get('content');
			this.set('newRecord', true);
			let deferred = Ember.RSVP.defer('crud-table#newRecord');
			component.sendAction('getRecord', deferred);
			deferred.promise.then(function(record) {
					if (record._internalModel !== undefined) {
						records.addObject(record._internalModel);
					} else {
						records.push(record);
					}
					ComplexModel.update(component);
					component.set('currentRecord', component.get('ComplexModel')[component.get('ComplexModel').length - 1]);
					modal.show();
				},
				function() {
					console.debug('Something went wrong');
				});
		},
		internal_edit(record) {
			this.set('notEdition', false);
			this.set('isEdition', true);
			this.set('isDeleting', false);
			this.set('currentRecord', record);
			modal.show();
		},
		internal_delete(record) {
			this.set('newRecord', false);
			this.set('isDeleting', true);
			this.set('currentRecord', record);
			modal.show();
		},
		intetnal_setlimit(limit) {
			limit = limit === "all" ? this.get('paginator').get('total') : limit;
			this.get('paginator').set('limit', limit);
			this.get('paginator').getBody(1, this.lastquery);
			this.get('filterset').getBody(this.lastquery);
			makeRequest(this, this.lastquery);
		},
		internal_reload() {
			makeRequest(this, this.lastquery);
		}
	}),
	metadata: metadata,
	makeRequest: makeRequest,
	_getRequest: _getRequest,
	lastquery: {},
	fieldDefinition: [],
};
