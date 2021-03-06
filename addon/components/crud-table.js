/*globals $, google*/
import Ember from 'ember';
import ComplexModel from '../privateclasses/complexmodel';
import pactions from '../privateclasses/actions';
let {
	actions,
	makeRequest,
	metadata,
	lastquery,
	fieldDefinition
} = pactions;
import modal from '../privateclasses/modal';

let component;
let PreLoad = [];

let PromiseHandler;
let PULLID = 0;
let PULLFN = function(cmp, time) {
	return setTimeout(function() {
		let deferred = Ember.RSVP.defer('crud-table#pulling');
		cmp.sendAction('searchRecord', lastquery, deferred);
		deferred.promise.then(function(records) {
				metadata(cmp, records);
				cmp.set('value', records);
				ComplexModel.update(component);
				PULLID = PULLFN(cmp, time);
			},
			function(data) {
				console.log(data.message);
			});
	}, time);
};
let PULL = function(cmp) {
	clearTimeout(PULLID);
	PULLID = 0;
	if (cmp.get('pulling') > 0) {
		PULLID = PULLFN(cmp, cmp.get('pulling'));
	}
};
export default Ember.Mixin.create({
	lastquery: lastquery,
	_table: "",
	canFilter: true,
	canRefresh: true,
	paginator: null,
	ComplexModel: {},
	pulling: false,
	stripped: false,
	search: true,
	hover: false,
	createRecord: 'create',
	updateRecord: 'update',
	deleteRecord: 'delete',
	cancelRecord: 'cancel',
	searchRecord: 'FetchData',
	newRecord: false,
	isDeleting: false,
	showMap: false,
	currentRecord: null,
	getRecord: 'getRecord',
	isLoading: null,
	isEdition: false,
	notEdition: true,
	SearchTerm: "",
	SearchField: "",
	SelectFilterProperty: "filterproperty",
	Callback: null,
	value: [],
	layoutName: 'ember-cli-crudtable/default/base',
	attributeBindings: ['data-role'],
	"data-role": "crud-table",
	classNameBindings: ['class'],
	class: "",
	fields: "id",
	labels: [],
	exports: true,
	filtercreation: false,
	CurrentState: null,
	filterset: null,
	filters: null,
	parent: null,
	actions: actions,
	init: function() {
		component = this;
		component.set('paginator', component.get('paginator')());
		if (component.get('parent')) {
			var ct = component.get('parent').get('crud-table');
			switch (typeof ct) {
				case "Object":
					component.get('parent').set('crud-table', [ct]);
					break;
				case "Array":
					component.get('parent').get('crud-table').addObject(component);
					break;
				default:
					component.get('parent').set('crud-table', component);
					break;
			}
		}
		component.get('paginator').init();
		component.set('labels', Ember.A([]));
		Object.keys(component.get('fields')).forEach(function(key) {
			if (component.fields[key].Default !== undefined) {
				fieldDefinition[key] = component.fields[key].Default;
			}
			if (component.fields[key].List !== false) {
				let label_cfg = Ember.Object.create({
					Type: (component.fields[key].Type || "text").split(":")[0],
					Visible: true,
					Key: key,
					Display: component.fields[key].Label || key,
					Search: component.fields[key].Search || false,
					Order: 0,
					Order_ASC: false,
					Order_DESC: false
				});
				component.get('labels').addObject(label_cfg);
				component.get('labels')[key] = label_cfg;
				component.fields[key].Type = component.fields[key].Type || "text";
			}
			if (component.fields[key].Source !== undefined) {
				Ember.assert('Action should be specified in Source field', component.fields[key].Source);
				let deferred = Ember.RSVP.defer('crud-table#dependant-table');
				PreLoad.push(deferred.promise);
				component.set('sideLoad', component.fields[key].Source);
				component.sendAction('sideLoad', deferred);
				deferred.promise.then(function(arr) {
						let dep = component.get('dependants') || Ember.Object.create({});
						dep[component.fields[key].Source] = arr;
						component.set('dependants', dep);
						component.set('sideLoad', null);
					},
					function(data) {
						let dep = component.get('dependants') || Ember.Object.create({});
						dep[component.fields[key].Source] = {
							isLoaded: true
						};
						component.set('dependants', dep);
						component.set('sideLoad', null);
						console.log(data.message);
					});

			}
		});
		PreLoad = [];
		component.set('editdelete', component.deleteRecord !== null || component.updateRecord !== null);
		component.set('isLoading', true);
		PULLID = 0;
		PromiseHandler = Ember.RSVP.defer('crud-table#SetUp');
		component.addObserver('pulling', function() {
			PULL(component);
		});
		if ((typeof component.get('filters')) === "function") {
			this.get('filters')().then((filters) => {
				component.get('filterset').init(filters || []);
			});
		} else {
			component.get('filterset').init(component.filters || []);
		}
		component.addObserver('filterset.filterupdated', this, function() {
			component.get('filterset').getBody(lastquery);
			makeRequest(component, lastquery);
		});
		this._super(...arguments);
	},
	didInsertElement: function() {
		component.get('paginator').getBody(1, lastquery);
		component.get('filterset').getBody(lastquery);
		makeRequest(component, lastquery);
		modal.init(component);
	},
	willDestroyElement: function() {
		$("#CrudTableDeleteRecordModal").remove();
	}
});
