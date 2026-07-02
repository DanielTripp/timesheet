let g_text_area_ids_with_write_scheduled = new buckets.Set();
const AUTO_SAVE_INTERVAL_MILLIS = 30*1000;
const AUTO_SAVE_HISTORY_HOURS_TO_KEEP = 2;

function initialize() {
	$('#textarea_input').on('propertychange keyup input paste', on_input_changed);
	$('#button_show_hide_autosaves').on('click', function() { toggle_display_of_autosaves('textarea_input'); });
	on_input_changed();

	bind_text_control_to_localstorage('textarea_input');
	bind_text_control_to_autosave_history('textarea_input');

	setInterval(update_decorations, 1000*10);
}

function get_date_from_hh_mm_str(hh_mm_str_) {
	let splits = hh_mm_str_.split(':', 2);
	let hours = parseInt(splits[0]);
	let minutes = parseInt(splits[1]);
	let r = new Date();
	r.setHours(hours);
	r.setMinutes(minutes);
	return r;
}

function on_input_changed() {
	update_decorations();
}

function get_hh_mm_str(date_) {
	return sprintf("%02d:%02d", date_.getHours(), date_.getMinutes());
}

function getDecorationStr(start_time_str_, end_time_str_) {
	/* if you change this, then change getDecorationStrRegexStr() too. */
	let r = `  [start=${start_time_str_}, end=${end_time_str_}]`;
	return r;
}

function getDecorationStrRegexStr() {
	return '[ ]{0,2}\\[start=\\d{1,2}:\\d\\d, end=\\d{1,2}:\\d\\d]';
}

/* I chose the regexes for "set time line" and "job line" to be pretty different, because once as a user I accidentally turned one line from the former into the latter, and that threw me off.  specifically, I changed this:
time=06:00
into this:
xtime=06:00
... and (an older version of) this function suddenly thought that that line was a job.  so now this function is more strict.  it considers a "time of day" to look like "NN:NN" and a "job duration" to look like "N:NN". 

note 1: these regexes allow whitespace at the start of the line, so that a line can start with whitespace and still get parsed-and-decorated.  the use case is that I copy and paste back and forth between notepad++ and this web page a lot, and in notepad++ a timesheet (= value of this text area) is usually indented. */
function update_decorations() {
	let textarea = $('#textarea_input').get(0);
	let selectionStart = textarea.selectionStart, selectionEnd = textarea.selectionEnd;
	const LINE_DELIM = '\n';
	let lines = textarea.value.split(LINE_DELIM);
	let total_num_hours = 0.0;
	let start_date = new Date();
	let set_time_of_day_regex = new RegExp(`^\\s*time=(\\d\\d:\\d\\d|now)(.*?)(${getDecorationStrRegexStr()})?\\s*$`, 'd'), 
	job_regex = new RegExp(`^\\s*[^[]*[^\\d=]*(\\d:\\d\\d)(.*?)(${getDecorationStrRegexStr()})?\\s*$`, 'd'); // see note 1 
	let cur_line_start_pos = 0, cur_line_end_pos = 0;
	for (let [iLine, line] of lines.entries()) {
		let new_line;
		cur_line_end_pos = cur_line_start_pos + line.length;
		let set_time_of_day_match = line.match(set_time_of_day_regex);
		let job_match = line.match(job_regex);
		if(set_time_of_day_match && job_match) throw new Error("impossible");
		if(set_time_of_day_match != null) {
			let is_cancelled = /\S/.test(set_time_of_day_match[2]);
			if(is_cancelled) {
				let new_decoration_str = '';
				let has_decoration_already = !!set_time_of_day_match[3];
				if(has_decoration_already) {
					let [old_decoration_start, old_decoration_end] = set_time_of_day_match.indices[3];
					new_line = line.slice(0, old_decoration_start) + new_decoration_str + line.slice(old_decoration_end);
				}
			} else {
				let new_time_of_day_str = set_time_of_day_match[1];
				let time_of_day_date = new_time_of_day_str === "now" ? new Date() : get_date_from_hh_mm_str(new_time_of_day_str);
				start_date = time_of_day_date;
				total_num_hours = 0.0;
				let start_time_str = get_hh_mm_str(start_date); end_time_str = start_time_str;
				let new_decoration_str = getDecorationStr(start_time_str, end_time_str);
				let has_decoration_already = !!set_time_of_day_match[3];
				if(has_decoration_already) {
					let [old_decoration_start, old_decoration_end] = set_time_of_day_match.indices[3];
					new_line = line.slice(0, old_decoration_start) + new_decoration_str + line.slice(old_decoration_end);
				} else {
					new_line = line + new_decoration_str;
				}
			}
		} else {
			if(job_match != null) {
				let is_cancelled = /\S/.test(job_match[2]);
				if(is_cancelled) {
					let new_decoration_str = '';
					let has_decoration_already = !!job_match[3];
					if(has_decoration_already) {
						let [old_decoration_start, old_decoration_end] = job_match.indices[3];
						new_line = line.slice(0, old_decoration_start) + new_decoration_str + line.slice(old_decoration_end);
					}
				} else {
					let num_hours_hh_mm_str = job_match[1];
					let num_hours_float = get_num_hours_float_from_HH_MM_str(num_hours_hh_mm_str);
					let start_time = new Date(start_date.getTime() + total_num_hours*60*60*1000);
					let start_time_str = get_hh_mm_str(start_time);
					total_num_hours += num_hours_float;
					let end_time = new Date(start_date.getTime() + total_num_hours*60*60*1000);
					let end_time_str = get_hh_mm_str(end_time);
					let new_decoration_str = getDecorationStr(start_time_str, end_time_str);
					let has_decoration_already = !!job_match[3];
					if(has_decoration_already) {
						let [old_decoration_start, old_decoration_end] = job_match.indices[3];
						new_line = line.slice(0, old_decoration_start) + new_decoration_str + line.slice(old_decoration_end);
					} else {
						new_line = line + new_decoration_str;
					}
				}
			}
		}
		function replace_cur_line(new_line__) {
			if(new_line__ !== undefined && new_line__ !== line) { /* setRangeText() breaks undo, so we don't want to call it any more than we need to. */
				textarea.setRangeText(new_line__, cur_line_start_pos, cur_line_end_pos);
			}
		}
		replace_cur_line(new_line);
		cur_line_start_pos += (new_line !== undefined ? new_line : line).length + LINE_DELIM.length;
	}
	if(selectionStart !== undefined && selectionEnd !== undefined) {
		textarea.selectionStart = selectionStart;
		textarea.selectionEnd = selectionEnd;
	} else {
		/* I think that if this ever happens, it will be rare. */
	}
}

function get_num_hours_float_from_HH_MM_str(hh_mm_str_) {
	let splits = hh_mm_str_.split(':', 2);
	let hours = parseInt(splits[0]);
	let minutes = parseInt(splits[1]);
	let r = hours + minutes/60.0;
	return r;
}

function get_HH_MM_str_from_num_hours_float(num_hours_float_) {
	let num_hours_int = Math.floor(num_hours_float_);
	let num_minutes = Math.round((num_hours_float_ - num_hours_int)*60);
	return sprintf("%d:%02d", num_hours_int, num_minutes);
}

function bind_text_control_to_localstorage(textarea_id_) {
	let storage_key = document.URL+' - textcontrol:'+textarea_id_;
	let stored_val = localStorage.getItem(storage_key);
	if(stored_val != null) {
		set_value(textarea_id_, stored_val);
	}
	$('#'+textarea_id_).bind('propertychange keyup input paste', function() {
		if(!g_text_area_ids_with_write_scheduled.contains(textarea_id_)) {
			let timer_func = function() {
				localStorage.setItem(storage_key, get_value(textarea_id_));
				g_text_area_ids_with_write_scheduled.remove(textarea_id_);
			};
			setTimeout(timer_func, 2000);
			g_text_area_ids_with_write_scheduled.add(textarea_id_);
		}
	});

	// The above write is supposed to catch all edits.  This one is a backup plan, in case that one has bugs: 
	setInterval(function() { localStorage.setItem(storage_key, get_value(textarea_id_)); }, 60*1000);
}

function get_autosave_storage_key(textarea_id_) {
	return document.URL+' - autosaves:'+textarea_id_;
}

function get_autosaves(textarea_id_) {
	let storage_key = get_autosave_storage_key(textarea_id_);
	let stored_val = localStorage.getItem(storage_key);
	if(stored_val == null) {
		return [];
	}
	let parsed_val = JSON.parse(stored_val);
	return parsed_val;
}

function set_autosaves_in_localstorage(textarea_id_, autosaves_) {
	let storage_key = get_autosave_storage_key(textarea_id_);
	localStorage.setItem(storage_key, JSON.stringify(autosaves_));
}

function get_local_timestamp_str(date_) {
	return sprintf(
		"%04d-%02d-%02d %02d:%02d:%02d",
		date_.getFullYear(),
		date_.getMonth() + 1,
		date_.getDate(),
		date_.getHours(),
		date_.getMinutes(),
		date_.getSeconds()
	);
}

function get_date_from_timestamp_str(timestamp_str_) {
	let match = timestamp_str_.match(/^(\d\d\d\d)-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)$/);
	if(match == null) {
		return null;
	}
	let year = parseInt(match[1]);
	let month = parseInt(match[2]);
	let day = parseInt(match[3]);
	let hours = parseInt(match[4]);
	let minutes = parseInt(match[5]);
	let seconds = parseInt(match[6]);
	return new Date(year, month - 1, day, hours, minutes, seconds);
}

function get_pruned_autosaves(autosaves_, now_) {
	let oldest_time_to_keep_millis = now_.getTime() - AUTO_SAVE_HISTORY_HOURS_TO_KEEP*60*60*1000;
	let r = [];
	for(let autosave of autosaves_) {
		let autosave_date = get_date_from_timestamp_str(autosave.timestamp);
		if(autosave_date != null && autosave_date.getTime() >= oldest_time_to_keep_millis) {
			r.push(autosave);
		}
	}
	return r;
}

function auto_save_text_control(textarea_id_) {
	let now = new Date();
	let autosaves = get_pruned_autosaves(get_autosaves(textarea_id_), now);
	let value = get_value(textarea_id_);
	let most_recent_autosave = autosaves.length > 0 ? autosaves[autosaves.length - 1] : null;
	if(most_recent_autosave == null || most_recent_autosave.value !== value) {
		autosaves.push({
			timestamp: get_local_timestamp_str(now),
			value: value
		});
	}
	set_autosaves_in_localstorage(textarea_id_, autosaves);
}

function bind_text_control_to_autosave_history(textarea_id_) {
	auto_save_text_control(textarea_id_);
	setInterval(() => { auto_save_text_control(textarea_id_); }, AUTO_SAVE_INTERVAL_MILLIS);
}

function toggle_display_of_autosaves(textarea_id_) {
	let autosaves_div = $('#div_autosaves');
	if(autosaves_div.css('display') === 'none') {
		populate_autosaves_table(textarea_id_);
		autosaves_div.show();
	} else {
		autosaves_div.hide();
	}
}

function populate_autosaves_table(textarea_id_) {
	let autosaves = get_autosaves(textarea_id_);
	let table = $('#table_autosaves');
	table.empty();

	let header_row = $('<tr></tr>');
	header_row.append($('<th></th>').text('Restore'));
	header_row.append($('<th></th>').text('Timestamp'));
	header_row.append($('<th></th>').text('Lines'));
	table.append(header_row);

	for(let i_autosave = autosaves.length - 1; i_autosave >= 0; --i_autosave) {
		let autosave = autosaves[i_autosave];
		let row = $('<tr></tr>');
		let restore_button = $('<button type="button">Restore</button>');
		restore_button.on('click', function() { restore_autosave(i_autosave); });
		row.append($('<td></td>').append(restore_button));
		row.append($('<td></td>').text(autosave.timestamp));
		row.append($('<td></td>').text(autosave.value.split('\n').length));
		table.append(row);
	}
}

function restore_autosave(i_autosave_) {
	let autosaves = get_autosaves('textarea_input');
	let autosave = autosaves[i_autosave_];
	set_value('textarea_input', autosave.value);
}

function get_value(textfieldname_) {
	return $("#"+textfieldname_).val();
}

function set_value(textfieldname_, value_) {
	return $("#"+textfieldname_).val(value_).trigger('input');
}

function radio_val(groupname_) {
	return $('input[name='+groupname_+']:checked').val();
}

window.addEventListener('load', initialize);

