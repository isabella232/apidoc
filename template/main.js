/** apidoc template main.js */
require.config({
  paths: {
    bootstrap: './vendor/bootstrap.min',
    diffMatchPatch: './vendor/diff_match_patch.min',
    handlebars: './vendor/handlebars.min',
    handlebarsExtended: './utils/handlebars_helper',
    jquery: './vendor/jquery.min',
    locales: './locales/locale',
    lodash: './vendor/lodash.custom.min',
    pathToRegexp: './vendor/path-to-regexp/index',
    prismjs: './vendor/prism',
    semver: './vendor/semver.min',
    utilsSampleRequest: './utils/send_sample_request',
    webfontloader: './vendor/webfontloader',
    list: './vendor/list.min',
    apiData: './api_data',
    apiProject: './api_project',
  },
  shim: {
    bootstrap: {
      deps: ['jquery'],
    },
    diffMatchPatch: {
      exports: 'diff_match_patch',
    },
    handlebars: {
      exports: 'Handlebars',
    },
    handlebarsExtended: {
      deps: ['jquery', 'handlebars'],
      exports: 'Handlebars',
    },
    prismjs: {
      exports: 'Prism',
    },
  },
  urlArgs: 'v=' + new Date().getTime(),
  waitSeconds: 150,
});

require([
  'jquery',
  'lodash',
  'locales',
  'handlebarsExtended',
  'apiProject',
  'apiData',
  'prismjs',
  'utilsSampleRequest',
  'semver',
  'webfontloader',
  'bootstrap',
  'pathToRegexp',
  'list',
], function ($, _, locale, Handlebars, apiProject, apiData, Prism, sampleRequest, semver, WebFont) {
  // Load google web fonts.
  WebFont.load({
    active: function () {
      // Only init after fonts are loaded.
      init($, _, locale, Handlebars, apiProject, apiData, Prism, sampleRequest, semver);
    },
    inactive: function () {
      // Run init, even if loading fonts fails
      init($, _, locale, Handlebars, apiProject, apiData, Prism, sampleRequest, semver);
    },
    google: {
      families: ['Source Code Pro', 'Source Sans Pro:n4,n6,n7'],
    },
  });
});

function init ($, _, locale, Handlebars, apiProject, apiData, Prism, sampleRequest, semver) {
  let api = apiData.api;

  //
  // Templates
  //
  const templateHeader = Handlebars.compile($('#template-header').html());
  const templateFooter = Handlebars.compile($('#template-footer').html());
  const templateArticle = Handlebars.compile($('#template-article').html());
  const templateCompareArticle = Handlebars.compile($('#template-compare-article').html());
  const templateGenerator = Handlebars.compile($('#template-generator').html());
  const templateProject = Handlebars.compile($('#template-project').html());
  const templateSections = Handlebars.compile($('#template-sections').html());
  const templateSidenav = Handlebars.compile($('#template-sidenav').html());

  //
  // apiProject defaults
  //
  if (!apiProject.template) { apiProject.template = {}; }

  if (apiProject.template.withCompare == null) { apiProject.template.withCompare = true; }

  if (apiProject.template.withGenerator == null) { apiProject.template.withGenerator = true; }

  if (apiProject.template.forceLanguage) { locale.setLanguage(apiProject.template.forceLanguage); }

  if (apiProject.template.aloneDisplay == null) { apiProject.template.aloneDisplay = false; }

  // Setup jQuery Ajax
  $.ajaxSetup(apiProject.template.jQueryAjaxSetup);

  //
  // Data transform
  //
  // grouped by group
  const apiByGroup = _.groupBy(api, function (entry) {
    return entry.group;
  });

  // grouped by group and name
  const apiByGroupAndName = {};
  $.each(apiByGroup, function (index, entries) {
    apiByGroupAndName[index] = _.groupBy(entries, function (entry) {
      return entry.name;
    });
  });

  //
  // sort api within a group by title ASC and custom order
  //
  const newList = [];
  const umlauts = { ä: 'ae', ü: 'ue', ö: 'oe', ß: 'ss' }; // TODO: remove in version 1.0
  $.each(apiByGroupAndName, function (index, groupEntries) {
    // get titles from the first entry of group[].name[] (name has versioning)
    let titles = [];
    $.each(groupEntries, function (titleName, entries) {
      const title = entries[0].title;
      if (title !== undefined) {
        title.toLowerCase().replace(/[äöüß]/g, function ($0) { return umlauts[$0]; });
        titles.push(title + '#~#' + titleName); // '#~#' keep reference to titleName after sorting
      }
    });
    // sort by name ASC
    titles.sort();

    // custom order
    if (apiProject.order) { titles = sortByOrder(titles, apiProject.order, '#~#'); }

    // add single elements to the new list
    titles.forEach(function (name) {
      const values = name.split('#~#');
      const key = values[1];
      groupEntries[key].forEach(function (entry) {
        newList.push(entry);
      });
    });
  });
  // api overwrite with ordered list
  api = newList;

  //
  // Group- and Versionlists
  //
  let apiGroups = {};
  const apiGroupTitles = {};
  let apiVersions = {};
  apiVersions[apiProject.version] = 1;

  $.each(api, function (index, entry) {
    apiGroups[entry.group] = 1;
    apiGroupTitles[entry.group] = entry.groupTitle || entry.group;
    apiVersions[entry.version] = 1;
  });

  // sort groups
  apiGroups = Object.keys(apiGroups);
  apiGroups.sort();

  // custom order
  if (apiProject.order) { apiGroups = sortByOrder(apiGroups, apiProject.order); }

  // sort versions DESC
  apiVersions = Object.keys(apiVersions);
  apiVersions.sort(semver.compare);
  apiVersions.reverse();

  //
  // create Navigationlist
  //
  const nav = [];
  apiGroups.forEach(function (group) {
    // Mainmenu entry
    nav.push({
      group: group,
      isHeader: true,
      title: apiGroupTitles[group],
    });

    // Submenu
    let oldName = '';
    api.forEach(function (entry) {
      if (entry.group === group) {
        if (oldName !== entry.name) {
          nav.push({
            title: entry.title,
            group: group,
            name: entry.name,
            type: entry.type,
            version: entry.version,
            url: entry.url,
          });
        } else {
          nav.push({
            title: entry.title,
            group: group,
            hidden: true,
            name: entry.name,
            type: entry.type,
            version: entry.version,
            url: entry.url,
          });
        }
        oldName = entry.name;
      }
    });
  });

  /**
     * Add navigation items by analyzing the HTML content and searching for h1 and h2 tags
     * @param nav Object the navigation array
     * @param content string the compiled HTML content
     * @param index where to insert items
     * @return boolean true if any good-looking (i.e. with a group identifier) <h1> tag was found
     */
  function addNav (nav, content, index) {
    let foundLevel1 = false;
    if (!content) {
      return foundLevel1;
    }
    const topics = content.match(/<h(1|2).*?>(.+?)<\/h(1|2)>/gi);
    if (topics) {
      topics.forEach(function (entry) {
        const level = entry.substring(2, 3);
        const title = entry.replace(/<.+?>/g, ''); // Remove all HTML tags for the title
        const entryTags = entry.match(/id="api-([^-]+)(?:-(.+))?"/); // Find the group and name in the id property
        const group = entryTags ? entryTags[1] : null;
        const name = entryTags ? entryTags[2] : null;
        if (level === '1' && title && group) {
          nav.splice(index, 0, {
            group: group,
            isHeader: true,
            title: title,
            isFixed: true,
          });
          index++;
          foundLevel1 = true;
        }
        if (level === '2' && title && group && name) {
          nav.splice(index, 0, {
            group: group,
            name: name,
            isHeader: false,
            title: title,
            isFixed: false,
            version: '1.0',
          });
          index++;
        }
      });
    }
    return foundLevel1;
  }

  let foundLevel1;
  // Mainmenu Header entry
  if (apiProject.header) {
    foundLevel1 = addNav(nav, apiProject.header.content, 0); // Add level 1 and 2 titles
    if (!foundLevel1) { // If no Level 1 tags were found, make a title
      nav.unshift({
        group: '_',
        isHeader: true,
        title: apiProject.header.title == null ? locale.__('General') : apiProject.header.title,
        isFixed: true,
      });
    }
  }

  // Mainmenu Footer entry
  if (apiProject.footer) {
    const lastNavIndex = nav.length;
    foundLevel1 = addNav(nav, apiProject.footer.content, nav.length); // Add level 1 and 2 titles
    if (!foundLevel1 && apiProject.footer.title != null) { // If no Level 1 tags were found, make a title
      nav.splice(lastNavIndex, 0, {
        group: '_footer',
        isHeader: true,
        title: apiProject.footer.title,
        isFixed: true,
      });
    }
  }

  // render pagetitle
  const title = apiProject.title ? apiProject.title : 'apiDoc: ' + apiProject.name + ' - ' + apiProject.version;
  $(document).attr('title', title);

  // remove loader
  $('#loader').remove();

  // render sidenav
  const fields = {
    nav: nav,
  };
  $('#sidenav').append(templateSidenav(fields));

  // render Generator
  $('#generator').append(templateGenerator(apiProject));

  // render Project
  _.extend(apiProject, { versions: apiVersions });
  $('#project').append(templateProject(apiProject));

  // render apiDoc, header/footer documentation
  if (apiProject.header) { $('#header').append(templateHeader(apiProject.header)); }

  if (apiProject.footer) { $('#footer').append(templateFooter(apiProject.footer)); }

  //
  // Render Sections and Articles
  //
  const articleVersions = {};
  let content = '';
  apiGroups.forEach(function (groupEntry) {
    const articles = [];
    let oldName = '';
    let fields = {};
    let title = groupEntry;
    let description = '';
    articleVersions[groupEntry] = {};

    // render all articles of a group
    api.forEach(function (entry) {
      if (groupEntry === entry.group) {
        if (oldName !== entry.name) {
          // determine versions
          api.forEach(function (versionEntry) {
            if (groupEntry === versionEntry.group && entry.name === versionEntry.name) {
              if (!Object.prototype.hasOwnProperty.call(articleVersions[entry.group], entry.name)) {
                articleVersions[entry.group][entry.name] = [];
              }
              articleVersions[entry.group][entry.name].push(versionEntry.version);
            }
          });
          fields = {
            article: entry,
            versions: articleVersions[entry.group][entry.name],
          };
        } else {
          fields = {
            article: entry,
            hidden: true,
            versions: articleVersions[entry.group][entry.name],
          };
        }

        // sampleUrl config can be an url or true
        if (apiProject.sampleUrl) {
          // a sampleUrl of true means we want to use the current location as sample url
          if (apiProject.sampleUrl === true) {
            apiProject.sampleUrl = window.location.origin;
          }
          fields.article.sampleRequest = [
            {
              url: apiProject.sampleUrl + fields.article.url,
            },
          ];
        }

        // add prefix URL for endpoint unless it's already absolute
        if (apiProject.url) {
          if (fields.article.url.substr(0, 4).toLowerCase() !== 'http') {
            fields.article.url = apiProject.url + fields.article.url;
          }
        }

        addArticleSettings(fields, entry);

        if (entry.groupTitle) { title = entry.groupTitle; }

        // TODO: make groupDescription compareable with older versions (not important for the moment)
        if (entry.groupDescription) { description = entry.groupDescription; }

        articles.push({
          article: templateArticle(fields),
          group: entry.group,
          name: entry.name,
          aloneDisplay: apiProject.template.aloneDisplay,
        });
        oldName = entry.name;
      }
    });

    // render Section with Articles
    fields = {
      group: groupEntry,
      title: title,
      description: description,
      articles: articles,
      aloneDisplay: apiProject.template.aloneDisplay,
    };
    content += templateSections(fields);
  });
  $('#sections').append(content);

  // Bootstrap Scrollspy
  $(this).scrollspy({ target: '#scrollingNav' });

  // Content-Scroll on Navigation click.
  $('.sidenav').find('a').on('click', function (e) {
    e.preventDefault();
    const id = $(this).attr('href');
    if ($(id).length > 0) { $('html,body').animate({ scrollTop: parseInt($(id).offset().top) }, 400); }
    window.location.hash = $(this).attr('href');
  });

  /**
     * Check if Parameter (sub) List has a type Field.
     * Example: @apiSuccess          varname1 No type.
     *          @apiSuccess {String} varname2 With type.
     *
     * @param {Object} fields
     */
  function _hasTypeInFields (fields) {
    let result = false;
    $.each(fields, function (name) {
      result = result || _.some(fields[name], function (item) { return item.type; });
    });
    return result;
  }

  /**
     * On Template changes, recall plugins.
     */
  function initDynamic () {
    // Bootstrap popover
    $('button[data-toggle="popover"]').popover().click(function (e) {
      e.preventDefault();
    });

    const version = $('#version strong').html();
    $('#sidenav li').removeClass('is-new');
    if (apiProject.template.withCompare) {
      $('#sidenav li[data-version=\'' + version + '\']').each(function () {
        const group = $(this).data('group');
        const name = $(this).data('name');
        const length = $('#sidenav li[data-group=\'' + group + '\'][data-name=\'' + name + '\']').length;
        const index = $('#sidenav li[data-group=\'' + group + '\'][data-name=\'' + name + '\']').index($(this));
        if (length === 1 || index === length - 1) { $(this).addClass('is-new'); }
      });
    }

    // tabs
    $('.nav-tabs-examples a').click(function (e) {
      e.preventDefault();
      $(this).tab('show');
    });
    $('.nav-tabs-examples').find('a:first').tab('show');

    // sample header-content-type switch
    $('.sample-header-content-type-switch').change(function () {
      const paramName = '.' + $(this).attr('name') + '-fields';
      const bodyName = '.' + $(this).attr('name') + '-body';
      const selectName = 'select[name=' + $(this).attr('name') + ']';
      if ($(this).val() === 'body-json') {
        $(selectName).val('undefined');
        $(this).val('body-json');
        $(paramName).removeClass('hide');
        $(this).parent().nextAll(paramName).first().addClass('hide');
        $(bodyName).addClass('hide');
        $(this).parent().nextAll(bodyName).first().removeClass('hide');
      } else if ($(this).val() === 'body-form-data') {
        $(selectName).val('undefined');
        $(this).val('body-form-data');
        $(bodyName).addClass('hide');
        $(paramName).removeClass('hide');
      } else {
        $(this).parent().nextAll(paramName).first().removeClass('hide');
        $(this).parent().nextAll(bodyName).first().addClass('hide');
      }
      $(this).prev('.sample-request-switch').prop('checked', true);
    });

    // sample request switch
    $('.sample-request-switch').click(function (e) {
      const paramName = '.' + $(this).attr('name') + '-fields';
      const bodyName = '.' + $(this).attr('name') + '-body';
      const select = $(this).next('.' + $(this).attr('name') + '-select').val();
      if ($(this).prop('checked')) {
        if (select === 'body-json') {
          $(this).parent().nextAll(bodyName).first().removeClass('hide');
        } else {
          $(this).parent().nextAll(paramName).first().removeClass('hide');
        }
      } else {
        if (select === 'body-json') {
          $(this).parent().nextAll(bodyName).first().addClass('hide');
        } else {
          $(this).parent().nextAll(paramName).first().addClass('hide');
        }
      }
    });

    if (apiProject.template.aloneDisplay) {
      // show group
      $('.show-group').click(function () {
        const apiGroup = '.' + $(this).attr('data-group') + '-group';
        const apiGroupArticle = '.' + $(this).attr('data-group') + '-article';
        $('.show-api-group').addClass('hide');
        $(apiGroup).removeClass('hide');
        $('.show-api-article').addClass('hide');
        $(apiGroupArticle).removeClass('hide');
      });

      // show api
      $('.show-api').click(function () {
        const apiName = '.' + $(this).attr('data-name') + '-article';
        const apiGroup = '.' + $(this).attr('data-group') + '-group';
        $('.show-api-group').addClass('hide');
        $(apiGroup).removeClass('hide');
        $('.show-api-article').addClass('hide');
        $(apiName).removeClass('hide');
      });
    }

    // call scrollspy refresh method
    $(window).scrollspy('refresh');

    // init modules
    sampleRequest.initDynamic();
    Prism.highlightAll();
  }
  initDynamic();

  if (apiProject.template.aloneDisplay) {
    const hashVal = window.location.hash;
    if (hashVal != null && hashVal.length !== 0) {
      $('.' + hashVal.slice(1) + '-init').click();
    }
  }

  //
  // HTML-Template specific jQuery-Functions
  //
  // Change Main Version
  function setMainVersion (selectedVersion) {
    if (typeof selectedVersion === 'undefined') {
      selectedVersion = $('#version strong').html();
    } else {
      $('#version strong').html(selectedVersion);
    }

    // hide all
    $('article').addClass('hide');
    $('#sidenav li:not(.nav-fixed)').addClass('hide');

    // show 1st equal or lower Version of each entry
    $('article[data-version]').each(function (index) {
      const group = $(this).data('group');
      const name = $(this).data('name');
      const version = $(this).data('version');

      if (semver.lte(version, selectedVersion)) {
        if ($('article[data-group=\'' + group + '\'][data-name=\'' + name + '\']:visible').length === 0) {
          // enable Article
          $('article[data-group=\'' + group + '\'][data-name=\'' + name + '\'][data-version=\'' + version + '\']').removeClass('hide');
          // enable Navigation
          $('#sidenav li[data-group=\'' + group + '\'][data-name=\'' + name + '\'][data-version=\'' + version + '\']').removeClass('hide');
          $('#sidenav li.nav-header[data-group=\'' + group + '\']').removeClass('hide');
        }
      }
    });

    // show 1st equal or lower Version of each entry
    $('article[data-version]').each(function (index) {
      const group = $(this).data('group');
      $('section#api-' + group).removeClass('hide');
      if ($('section#api-' + group + ' article:visible').length === 0) {
        $('section#api-' + group).addClass('hide');
      } else {
        $('section#api-' + group).removeClass('hide');
      }
    });

    initDynamic();
  }
  setMainVersion();

  $('#versions li.version a').on('click', function (e) {
    e.preventDefault();

    setMainVersion($(this).html());
  });

  // compare all article with their predecessor
  $('#compareAllWithPredecessor').on('click', changeAllVersionCompareTo);

  // change version of an article
  $('article .versions li.version a').on('click', changeVersionCompareTo);

  // compare url-parameter
  $.urlParam = function (name) {
    const results = new RegExp('[\\?&amp;]' + name + '=([^&amp;#]*)').exec(window.location.href);
    return results && results[1] ? results[1] : null;
  };

  if ($.urlParam('compare')) {
    // URL Paramter ?compare=1 is set
    $('#compareAllWithPredecessor').trigger('click');
  }

  // Quick jump on page load to hash position.
  // Should happen after setting the main version
  // and after triggering the click on the compare button,
  // as these actions modify the content
  // and would make it jump to the wrong position or not jump at all.
  if (window.location.hash) {
    const id = decodeURI(window.location.hash);
    if ($(id).length > 0) { $('html,body').animate({ scrollTop: parseInt($(id).offset().top) }, 0); }
  }

  /**
     * Initialize search
     */
  const options = {
    valueNames: ['nav-list-item', 'nav-list-url-item'],
  };
  const endpointsList = new List('scrollingNav', options); // eslint-disable-line no-undef

  /**
     * Set initial focus to search input
     */
  $('#scrollingNav .sidenav-search input.search').focus();

  /**
     * Detect ESC key to reset search
     */
  $(document).keyup(function (e) {
    if (e.keyCode === 27) $('span.search-reset').click();
  });

  /**
     * Search reset
     */
  $('span.search-reset').on('click', function () {
    $('#scrollingNav .sidenav-search input.search')
      .val('')
      .focus()
    ;
    endpointsList.search();
  });

  /**
     * Change version of an article to compare it to an other version.
     */
  function changeVersionCompareTo (e) {
    e.preventDefault();

    const $root = $(this).parents('article');
    const selectedVersion = $(this).html();
    const $button = $root.find('.version');
    const currentVersion = $button.find('strong').html();
    $button.find('strong').html(selectedVersion);

    const group = $root.data('group');
    const name = $root.data('name');
    const version = $root.data('version');

    const compareVersion = $root.data('compare-version');

    if (compareVersion === selectedVersion) { return; }

    if (!compareVersion && version === selectedVersion) { return; }

    if ((compareVersion && (articleVersions[group][name][0] === selectedVersion)) || version === selectedVersion) { // eslint-disable-line no-extra-parens
      // the version of the entry is set to the highest version (reset)
      resetArticle(group, name, version);
    } else {
      let sourceEntry = {};
      let compareEntry = {};
      $.each(apiByGroupAndName[group][name], function (index, entry) {
        if (entry.version === version) { sourceEntry = entry; }
        if (entry.version === selectedVersion) { compareEntry = entry; }
      });

      const fields = {
        article: sourceEntry,
        compare: compareEntry,
        versions: articleVersions[group][name],
      };

      // add unique id
      // TODO: replace all group-name-version in template with id.
      fields.article.id = fields.article.group + '-' + fields.article.name + '-' + fields.article.version;
      fields.article.id = fields.article.id.replace(/\./g, '_');

      fields.compare.id = fields.compare.group + '-' + fields.compare.name + '-' + fields.compare.version;
      fields.compare.id = fields.compare.id.replace(/\./g, '_');

      let entry = sourceEntry;
      if (entry.parameter && entry.parameter.fields) { fields._hasTypeInParameterFields = _hasTypeInFields(entry.parameter.fields); }

      if (entry.error && entry.error.fields) { fields._hasTypeInErrorFields = _hasTypeInFields(entry.error.fields); }

      if (entry.success && entry.success.fields) { fields._hasTypeInSuccessFields = _hasTypeInFields(entry.success.fields); }

      if (entry.info && entry.info.fields) { fields._hasTypeInInfoFields = _hasTypeInFields(entry.info.fields); }

      entry = compareEntry;
      if (fields._hasTypeInParameterFields !== true && entry.parameter && entry.parameter.fields) { fields._hasTypeInParameterFields = _hasTypeInFields(entry.parameter.fields); }

      if (fields._hasTypeInErrorFields !== true && entry.error && entry.error.fields) { fields._hasTypeInErrorFields = _hasTypeInFields(entry.error.fields); }

      if (fields._hasTypeInSuccessFields !== true && entry.success && entry.success.fields) { fields._hasTypeInSuccessFields = _hasTypeInFields(entry.success.fields); }

      if (fields._hasTypeInInfoFields !== true && entry.info && entry.info.fields) { fields._hasTypeInInfoFields = _hasTypeInFields(entry.info.fields); }

      const content = templateCompareArticle(fields);
      $root.after(content);
      const $content = $root.next();

      // Event on.click re-assign
      $content.find('.versions li.version a').on('click', changeVersionCompareTo);

      // select navigation
      $('#sidenav li[data-group=\'' + group + '\'][data-name=\'' + name + '\'][data-version=\'' + currentVersion + '\']').addClass('has-modifications');

      $root.remove();
      // TODO: on change main version or select the highest version re-render
    }

    initDynamic();
  }

  /**
     * Compare all currently selected Versions with their predecessor.
     */
  function changeAllVersionCompareTo (e) {
    e.preventDefault();
    $('article:visible .versions').each(function () {
      const $root = $(this).parents('article');
      const currentVersion = $root.data('version');
      let $foundElement = null;
      $(this).find('li.version a').each(function () {
        const selectVersion = $(this).html();
        if (selectVersion < currentVersion && !$foundElement) { $foundElement = $(this); }
      });

      if ($foundElement) { $foundElement.trigger('click'); }
    });
    initDynamic();
  }

  /**
     * Add article settings.
     */
  function addArticleSettings (fields, entry) {
    // add unique id
    // TODO: replace all group-name-version in template with id.
    fields.id = fields.article.group + '-' + fields.article.name + '-' + fields.article.version;
    fields.id = fields.id.replace(/\./g, '_');

    if (entry.header && entry.header.fields) {
      fields._hasTypeInHeaderFields = _hasTypeInFields(entry.header.fields);
    }

    if (entry.parameter && entry.parameter.fields) {
      fields._hasTypeInParameterFields = _hasTypeInFields(entry.parameter.fields);
    }

    if (entry.error && entry.error.fields) {
      fields._hasTypeInErrorFields = _hasTypeInFields(entry.error.fields);
    }

    if (entry.success && entry.success.fields) {
      fields._hasTypeInSuccessFields = _hasTypeInFields(entry.success.fields);
    }

    if (entry.info && entry.info.fields) {
      fields._hasTypeInInfoFields = _hasTypeInFields(entry.info.fields);
    }

    // add template settings
    fields.template = apiProject.template;
  }

  /**
     * Render Article.
     */
  function renderArticle (group, name, version) {
    let entry = {};
    $.each(apiByGroupAndName[group][name], function (index, currentEntry) {
      if (currentEntry.version === version) { entry = currentEntry; }
    });
    const fields = {
      article: entry,
      versions: articleVersions[group][name],
    };

    addArticleSettings(fields, entry);

    return templateArticle(fields);
  }

  /**
     * Render original Article and remove the current visible Article.
     */
  function resetArticle (group, name, version) {
    const $root = $('article[data-group=\'' + group + '\'][data-name=\'' + name + '\']:visible');
    const content = renderArticle(group, name, version);

    $root.after(content);
    const $content = $root.next();

    // Event on.click needs to be reassigned (should actually work with on ... automatically)
    $content.find('.versions li.version a').on('click', changeVersionCompareTo);

    $('#sidenav li[data-group=\'' + group + '\'][data-name=\'' + name + '\'][data-version=\'' + version + '\']').removeClass('has-modifications');

    $root.remove();
  }

  /**
     * Return ordered entries by custom order and append not defined entries to the end.
     * @param  {String[]} elements
     * @param  {String[]} order
     * @param  {String}   splitBy
     * @return {String[]} Custom ordered list.
     */
  function sortByOrder (elements, order, splitBy) {
    const results = [];
    order.forEach(function (name) {
      if (splitBy) {
        elements.forEach(function (element) {
          const parts = element.split(splitBy);
          const key = parts[0]; // reference keep for sorting
          if (key === name || parts[1] === name) { results.push(element); }
        });
      } else {
        elements.forEach(function (key) {
          if (key === name) { results.push(name); }
        });
      }
    });
    // Append all other entries that ar not defined in order
    elements.forEach(function (element) {
      if (results.indexOf(element) === -1) { results.push(element); }
    });
    return results;
  }
  Prism.highlightAll();
}
