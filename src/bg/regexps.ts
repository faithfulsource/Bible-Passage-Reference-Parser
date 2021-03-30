import { bcv_parser } from "../core";

bcv_parser.prototype.regexps.space = "[\\s\\xa0]";
/*
 * - Line 1		- Beginning of string or not in the middle of a word or immediately following another book. Only count a book if it's part of a sequence: `Matt5John3` is OK, but not `1Matt5John3`
 * - Lines 3-13	- inverted book/chapter (cb)
 * - Line 11	- no plurals here since it's a single chapter
 * - Line 14	- book
 * - Line 16	- special Psalm chapters
 * - Line 18	- could be followed by a number
 * - Line 20	- a-e allows 1:1a
 * - Line 21	- or the end of the string
 */
bcv_parser.prototype.regexps.escaped_passage = new RegExp(`\
(?:^|[^\\x1f\\x1e\\dA-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])\
(\
(?:\
(?:ch(?:apters?|a?pts?\\.?|a?p?s?\\.?)?\\s*\
\\d+\\s*(?:[\\u2013\\u2014\\-]|through|thru|to)\\s*\\d+\\s*\
(?:from|of|in)(?:\\s+the\\s+book\\s+of)?\\s*)\
|(?:ch(?:apters?|a?pts?\\.?|a?p?s?\\.?)?\\s*\
\\d+\\s*\
(?:from|of|in)(?:\\s+the\\s+book\\s+of)?\\s*)\
|(?:\\d+(?:th|nd|st)\\s*\
ch(?:apter|a?pt\\.?|a?p?\\.?)?\\s*\
(?:from|of|in)(?:\\s+the\\s+book\\s+of)?\\s*)\
)?\
\\x1f(\\d+)(?:/\\d+)?\\x1f\
(?:\
/\\d+\\x1f\
|[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014]\
|title(?![a-z])\
|и${bcv_parser.prototype.regexps.space}+сл|глава|глави|гл|ст|-|и\
|[aавб](?!\\w)\
|$\
)+\
)`, "gi");
// These are the only valid ways to end a potential passage match. The closing parenthesis allows for fully capturing parentheses surrounding translations (ESV**)**. The last one, `[\d\x1f]` needs not to be +; otherwise `Gen5ff` becomes `\x1f0\x1f5ff`, and `adjust_regexp_end` matches the `\x1f5` and incorrectly dangles the ff.
// 'ff09' is a full-width closing parenthesis.
bcv_parser.prototype.regexps.match_end_split = new RegExp(`\
\\d\\W*title\
|\\d\\W*и${bcv_parser.prototype.regexps.space}+сл(?:[\\s\\xa0*]*\\.)?\
|\\d[\\s\\xa0*]*[aавб](?!\\w)\
|\\x1e(?:[\\s\\xa0*]*[)\\]\\uff09])?\
|[\\d\\x1f]`, "gi");
bcv_parser.prototype.regexps.control = /[\x1e\x1f]/g;
bcv_parser.prototype.regexps.pre_book = "[^A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ]";

bcv_parser.prototype.regexps.first = `(?:Първа|Първо|1|I)\\.?${bcv_parser.prototype.regexps.space}*`;
bcv_parser.prototype.regexps.second = `(?:Втора|Второ|2|II)\\.?${bcv_parser.prototype.regexps.space}*`;
bcv_parser.prototype.regexps.third = `(?:Трета|Трето|3|III)\\.?${bcv_parser.prototype.regexps.space}*`;
bcv_parser.prototype.regexps.range_and = `(?:[&\u2013\u2014-]|и|-)`;
bcv_parser.prototype.regexps.range_only = "(?:[\u2013\u2014-]|-)";
// Each book regexp should return two parenthesized objects: an optional preliminary character and the book itself.
bcv_parser.prototype.regexps.get_books = (include_apocrypha: boolean, case_sensitive: string) => {
	const books = [
		{
			osis: ["Ps"],
			apocrypha: true,
			extra: "2",
			/*
			 * - Don't match a preceding \d like usual because we only want to match a valid OSIS, which will never have a preceding digit.
			 * - Always followed by ".1"; the regular Psalms parser can handle `Ps151` on its own.
			 * - Case-sensitive because we only want to match a valid OSIS.
			 */
			regexp: /(\b)(Ps151)(?=\.1)/g
		},
		{
			osis: ["Gen"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Първ(?:а[\\s\\xa0]*(?:книга[\\s\\xa0]*)?|о[\\s\\xa0]*)Моисеева|[1I]\\.[\\s\\xa0]*Моисеева|[1I][\\s\\xa0]*Моисеева|Битие|Бит|Gen))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Exod"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Втор(?:а[\\s\\xa0]*(?:книга[\\s\\xa0]*)?|о[\\s\\xa0]*)Моисеева|(?:II|2)\\.[\\s\\xa0]*Моисеева|(?:II|2)[\\s\\xa0]*Моисеева|Изход|Exod|Изх))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Bel"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Вил(?:[\\s\\xa0]*и[\\s\\xa0]*змеят)?|Бел|Bel))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Lev"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Трет(?:а[\\s\\xa0]*(?:книга[\\s\\xa0]*)?|о[\\s\\xa0]*)Моисеева|(?:III|3)\\.[\\s\\xa0]*Моисеева|(?:III|3)[\\s\\xa0]*Моисеева|Левит|Лев|Lev))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Num"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Ч(?:етвърт(?:а[\\s\\xa0]*(?:книга[\\s\\xa0]*)?|о[\\s\\xa0]*)Моисеева|ис(?:ла|л)?)|(?:IV|4)\\.[\\s\\xa0]*Моисеева|(?:IV|4)[\\s\\xa0]*Моисеева|Num))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Sir"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*(?:Премъдрост[\\s\\xa0]*на[\\s\\xa0]*Иисуса,[\\s\\xa0]*син[\\s\\xa0]*Сирахов|на[\\s\\xa0]*Сирах)|Премъдрост[\\s\\xa0]*на[\\s\\xa0]*Иисус,[\\s\\xa0]*син[\\s\\xa0]*Сирахов|Сирахов|Сир(?:ах)?|Sir))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Wis"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*(?:Премъдрост[\\s\\xa0]*Соломонов|на[\\s\\xa0]*мъдростт)а|Премъдрост[\\s\\xa0]*на[\\s\\xa0]*Соломон|Премъдрост[\\s\\xa0]*Соломонова|Прем(?:ъдрост)?|Wis))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Lam"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*Плач[\\s\\xa0]*Иеремиев|П(?:лачът[\\s\\xa0]*на[\\s\\xa0]*(?:[ИЙ]е|Е)ремия|(?:\\.[\\s\\xa0]*[ИЙ]|[\\s\\xa0]*[ИЙ])ер)|Плач[\\s\\xa0]*Иеремиев|Плач[\\s\\xa0]*Еремиев|Плач(?:[\\s\\xa0]*Иер)?|Lam))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["EpJer"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:По(?:с(?:лание[\\s\\xa0]*на[\\s\\xa0]*[ИЙ]еремия|(?:\\.[\\s\\xa0]*[ИЙ]|[\\s\\xa0]*[ИЙ])ер)|ел\\.?[\\s\\xa0]*Иер)|EpJer))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Rev"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Отк(?:р(?:овение(?:[\\s\\xa0]*на[\\s\\xa0]*(?:св\\.?[\\s\\xa0]*Иоана[\\s\\xa0]*Богослова|[ИЙ]оан)|то[\\s\\xa0]*на[\\s\\xa0]*[ИЙ]оан)?)?)?|Апокалипсис|Rev))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["PrMan"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:М(?:олитвата[\\s\\xa0]*на[\\s\\xa0]*Манасия|анасия|\\.?[\\s\\xa0]*Ман)|PrMan))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Deut"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Пета[\\s\\xa0]*книга[\\s\\xa0]*Моисеева|Второзаконие|5[\\s\\xa0]*Моисеева|Вт(?:ор(?:озак)?)?|Deut))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Josh"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*(?:на[\\s\\xa0]*Исус[\\s\\xa0]*Навиев|Иисус[\\s\\xa0]*Навин)|Иисус[\\s\\xa0]*Навин|И(?:с(?:ус[\\s\\xa0]*Навие|\\.[\\s\\xa0]*На|[\\s\\xa0]*На)|ис\\.?[\\s\\xa0]*На)в|И(?:сус[\\s\\xa0]*Навин|(?:\\.[\\s\\xa0]?|[\\s\\xa0])Н)|Josh))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Judg"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*(?:Съдии[\\s\\xa0]*Израилеви|на[\\s\\xa0]*съдиите)|Съдии[\\s\\xa0]*Израилеви|Съд(?:ии)?|Judg))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Ruth"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*Рут|Ruth|Рут))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Esd"],
			apocrypha: true,
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Първ(?:а[\\s\\xa0]*(?:книга[\\s\\xa0]*на[\\s\\xa0]*)?|о[\\s\\xa0]*)Ездра|[1I]\\.[\\s\\xa0]*Ездра|1(?:[\\s\\xa0]*Ездра|[\\s\\xa0]*Ездр?|Esd)|I[\\s\\xa0]*Ездра))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Esd"],
			apocrypha: true,
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Втор(?:а[\\s\\xa0]*(?:книга[\\s\\xa0]*на[\\s\\xa0]*)?|о[\\s\\xa0]*)Ездра|(?:Трет[ао]|(?:III?|[23])\\.)[\\s\\xa0]*Ездра|III?[\\s\\xa0]*Ездра|3[\\s\\xa0]*Ездра|2(?:[\\s\\xa0]*Ездра|Esd)|3[\\s\\xa0]*Ездр|2[\\s\\xa0]*Ездр?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Isa"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*Исаия|Исаия|Исая|Isa|Ис))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Sam"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Втор(?:о[\\s\\xa0]*(?:Книга[\\s\\xa0]*на[\\s\\xa0]*царете|Цар(?:ства|е)|Цар(?:ств)?|Самуил)|а[\\s\\xa0]*(?:книга[\\s\\xa0]*(?:на[\\s\\xa0]*Самуил|Царства)|Книга[\\s\\xa0]*на[\\s\\xa0]*царете|Цар(?:ства|е)|Цар(?:ств)?|Самуил))|(?:(?:II|2)\\.|II|2)[\\s\\xa0]*Книга[\\s\\xa0]*на[\\s\\xa0]*царете|(?:(?:II|2)\\.|II)[\\s\\xa0]*Цар(?:ства|е)|(?:(?:II|2)\\.|II)[\\s\\xa0]*Цар(?:ств)?|(?:(?:II|2)\\.|II|2)[\\s\\xa0]*Самуил|2(?:[\\s\\xa0]*Цар(?:ства|е)|Sam)|2[\\s\\xa0]*Ц(?:ар(?:ств)?)?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Sam"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Първ(?:о[\\s\\xa0]*(?:Книга[\\s\\xa0]*на[\\s\\xa0]*царете|Цар(?:ства|е)|Цар(?:ств)?|Самуил)|а[\\s\\xa0]*(?:книга[\\s\\xa0]*(?:на[\\s\\xa0]*Самуил|Царства)|Книга[\\s\\xa0]*на[\\s\\xa0]*царете|Цар(?:ства|е)|Цар(?:ств)?|Самуил))|(?:[1I]\\.|[1I])[\\s\\xa0]*Книга[\\s\\xa0]*на[\\s\\xa0]*царете|(?:[1I]\\.|I)[\\s\\xa0]*Цар(?:ства|е)|(?:[1I]\\.|I)[\\s\\xa0]*Цар(?:ств)?|1(?:[\\s\\xa0]*Цар(?:ства|е)|Sam)|(?:[1I]\\.|[1I])[\\s\\xa0]*Самуил|1[\\s\\xa0]*Ц(?:ар(?:ств)?)?))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Kgs"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Четвърт(?:о[\\s\\xa0]*(?:Книга[\\s\\xa0]*на[\\s\\xa0]*царете|Цар(?:ства|ств|е)?)|а[\\s\\xa0]*(?:Книга[\\s\\xa0]*на[\\s\\xa0]*царете|книга[\\s\\xa0]*Царства|Цар(?:ства|е)|Цар(?:ств)?))|(?:(?:IV|4)\\.|IV|4)[\\s\\xa0]*Книга[\\s\\xa0]*на[\\s\\xa0]*царете|(?:(?:IV|4)\\.|IV)[\\s\\xa0]*Цар(?:ства|е)|(?:(?:IV|4)\\.|IV)[\\s\\xa0]*Цар(?:ств)?|4[\\s\\xa0]*Цар(?:ства|е)|4[\\s\\xa0]*Ц(?:ар(?:ств)?)?|2Kgs)|(?:Четвърта[\\s\\xa0]*книга[\\s\\xa0]*на[\\s\\xa0]*царете))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Kgs"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Трет(?:о[\\s\\xa0]*(?:Книга[\\s\\xa0]*на[\\s\\xa0]*царете|Цар(?:ства|ств|е)?)|а[\\s\\xa0]*(?:Книга[\\s\\xa0]*на[\\s\\xa0]*царете|книга[\\s\\xa0]*Царства|Цар(?:ства|е)|Цар(?:ств)?))|(?:(?:III|3)\\.|III|3)[\\s\\xa0]*Книга[\\s\\xa0]*на[\\s\\xa0]*царете|(?:(?:III|3)\\.|III)[\\s\\xa0]*Цар(?:ства|е)|(?:(?:III|3)\\.|III)[\\s\\xa0]*Цар(?:ств)?|3[\\s\\xa0]*Цар(?:ства|е)|3[\\s\\xa0]*Ц(?:ар(?:ств)?)?|1Kgs)|(?:Трета[\\s\\xa0]*книга[\\s\\xa0]*на[\\s\\xa0]*царете))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Chr"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:или[\\s\\xa0]*Втора[\\s\\xa0]*книга[\\s\\xa0]*Паралипоменон|Втор[ао][\\s\\xa0]*(?:Книга[\\s\\xa0]*на[\\s\\xa0]*летописите|Летописи|Парал)|(?:II|2)\\.[\\s\\xa0]*(?:Книга[\\s\\xa0]*на[\\s\\xa0]*летописите|Летописи|Парал)|(?:II|2)[\\s\\xa0]*(?:Книга[\\s\\xa0]*на[\\s\\xa0]*летописите|Летописи|Парал)|(?:Втор[ао]|(?:II|2)\\.|II|2)[\\s\\xa0]*Лет|2Chr)|(?:Втора[\\s\\xa0]*книга[\\s\\xa0]*(?:на[\\s\\xa0]*летописите|Паралипоменон)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Chr"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:или[\\s\\xa0]*Първа[\\s\\xa0]*книга[\\s\\xa0]*Паралипоменон|Първ[ао][\\s\\xa0]*(?:Книга[\\s\\xa0]*на[\\s\\xa0]*летописите|Летописи|Парал)|[1I]\\.[\\s\\xa0]*(?:Книга[\\s\\xa0]*на[\\s\\xa0]*летописите|Летописи|Парал)|[1I][\\s\\xa0]*(?:Книга[\\s\\xa0]*на[\\s\\xa0]*летописите|Летописи|Парал)|(?:Първ[ао]|[1I]\\.|[1I])[\\s\\xa0]*Лет|1Chr)|(?:Първа[\\s\\xa0]*книга[\\s\\xa0]*(?:на[\\s\\xa0]*летописите|Паралипоменон)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Ezra"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*Ездра|Ездра|Ezra|Езд))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Neh"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*Неемия|Неемия|Неем|Neh))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["GkEsth"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*Естир[\\s\\xa0]*\\(според[\\s\\xa0]*Септуагинта\\)|Естир[\\s\\xa0]*\\(според[\\s\\xa0]*Септуагинта\\)|Ест\\.?[\\s\\xa0]*Септ|GkEsth))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Esth"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*Естир|Естир|Esth|Ест))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Job"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*(?:Иова?|Йов)|Job|[ИЙ]ов))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Ps"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Пс(?:ал(?:тир|ом|ми))?|Ps))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["PrAzar"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:М(?:олитвата[\\s\\xa0]*на[\\s\\xa0]*Азария|\\.?[\\s\\xa0]*Аза)|PrAzar))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Prov"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*Притчи[\\s\\xa0]*Соломонови|Притчи[\\s\\xa0]*Соломонови|Пр(?:итчи?)?|Prov))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Eccl"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*Еклисиаста[\\s\\xa0]*или[\\s\\xa0]*Проповедника|Проповедника|Екл(?:исиаста|есиаст)|Екл(?:исиаст)?|Eccl))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["SgThree"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:П(?:есента[\\s\\xa0]*на[\\s\\xa0]*тримата[\\s\\xa0]*младежи|\\.?[\\s\\xa0]*Мл)|SgThree))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Song"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*Песен[\\s\\xa0]*на[\\s\\xa0]*Песните,[\\s\\xa0]*от[\\s\\xa0]*Соломона|П(?:ес(?:ен[\\s\\xa0]*на[\\s\\xa0]*песните|\\.?[\\s\\xa0]*на[\\s\\xa0]*песн)|\\.?[\\s\\xa0]*П)|Song|Пес))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Jer"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*(?:[ИЙ]е|Е)ремия|(?:[ИЙ]е|Е)ремия|(?:[ИЙ]е|Е)р|Jer))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Ezek"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*(?:Иезекииля|Езекиил)|Иезекииля|Иез(?:екиил)?|Йезекиил|Езекиил|Езекил|Езек|Ezek|Йез))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Dan"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*Даниила?|Даниила?|Данаил|Дан|Dan))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Hos"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*Осия|Осия|Hos|Ос))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Joel"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*Иоиля?|Иоиля?|Йоил|Joel))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Amos"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*Амоса?|Амоса?|Amos|Ам))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Obad"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*Авди[ий]|Авди[ий]|Obad|Авд))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Jonah"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*Иона|Jonah|[ИЙ]она|[ИЙ]он))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Mic"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*Михе[ий]|Михе[ий]|Мих|Mic))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Nah"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*Наума?|Наума?|Nah))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Hab"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Авк)|(?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*Авакума?|Авакума?|Ав(?:ак)?|Hab))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Zeph"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*Софония|Софони[ийя]|Zeph|Соф))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Hag"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*Аге[ий]|Аге[ий]|Hag|Аг))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Zech"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*Захария|Захария|Zech|Зах))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Mal"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*пророк[\\s\\xa0]*Малахия|Малахия|Мал|Mal))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Matt"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:От[\\s\\xa0]*Матея(?:[\\s\\xa0]*свето[\\s\\xa0]*Евангелие)?|Евангелие[\\s\\xa0]*от[\\s\\xa0]*Мате[ий]|Мате[ий]|Matt|Мат|Мт))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Mark"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:От[\\s\\xa0]*Марка(?:[\\s\\xa0]*свето[\\s\\xa0]*Евангелие)?|Евангелие[\\s\\xa0]*от[\\s\\xa0]*Марко|М(?:арко|к)|Марк|Mark))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Luke"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:От[\\s\\xa0]*Лука(?:[\\s\\xa0]*свето[\\s\\xa0]*Евангелие)?|Евангелие[\\s\\xa0]*от[\\s\\xa0]*Лука|Л(?:ука|к)|Luke|Лук))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1John"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Първ(?:о[\\s\\xa0]*(?:съборно[\\s\\xa0]*послание[\\s\\xa0]*на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Иоана[\\s\\xa0]*Богослова|послание[\\s\\xa0]*на[\\s\\xa0]*[ИЙ]оан|[ИЙ]оаново|[ИЙ]оан)|а[\\s\\xa0]*(?:[ИЙ]оаново|[ИЙ]оан))|(?:[1I]\\.[\\s\\xa0]*[ИЙ]|I[\\s\\xa0]*[ИЙ])оаново|1(?:[\\s\\xa0]*[ИЙ]оаново|John|[\\s\\xa0]*[ИЙ]н)|(?:(?:[1I]\\.[\\s\\xa0]*[ИЙ]|I[\\s\\xa0]*[ИЙ])о|1[\\s\\xa0]*[ИЙ]о)ан))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2John"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Втор(?:о[\\s\\xa0]*(?:съборно[\\s\\xa0]*послание[\\s\\xa0]*на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Иоана[\\s\\xa0]*Богослова|послание[\\s\\xa0]*на[\\s\\xa0]*[ИЙ]оан|[ИЙ]оаново|[ИЙ]оан)|а[\\s\\xa0]*(?:[ИЙ]оаново|[ИЙ]оан))|(?:(?:II|2)\\.[\\s\\xa0]*[ИЙ]|II[\\s\\xa0]*[ИЙ])оаново|2(?:[\\s\\xa0]*[ИЙ]оаново|John|[\\s\\xa0]*[ИЙ]н)|(?:(?:(?:II|2)\\.[\\s\\xa0]*[ИЙ]|II[\\s\\xa0]*[ИЙ])о|2[\\s\\xa0]*[ИЙ]о)ан))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["3John"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:3[\\s\\xa0]*[ИЙ]оаново)|(?:Трет(?:о[\\s\\xa0]*(?:съборно[\\s\\xa0]*послание[\\s\\xa0]*на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Иоана[\\s\\xa0]*Богослова|послание[\\s\\xa0]*на[\\s\\xa0]*[ИЙ]оан|[ИЙ]оаново|[ИЙ]оан)|а[\\s\\xa0]*(?:[ИЙ]оаново|[ИЙ]оан))|(?:(?:III|3)\\.[\\s\\xa0]*[ИЙ]|III[\\s\\xa0]*[ИЙ])оаново|(?:(?:III|3)\\.[\\s\\xa0]*[ИЙ]|III[\\s\\xa0]*[ИЙ])оан|3[\\s\\xa0]*[ИЙ]оан|3(?:John|[\\s\\xa0]*[ИЙ]н)))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["John"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:От[\\s\\xa0]*Иоана(?:[\\s\\xa0]*свето[\\s\\xa0]*Евангелие)?|Евангелие[\\s\\xa0]*от[\\s\\xa0]*[ИЙ]оан|John|[ИЙ]оан|[ИЙ]н))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Acts"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Д(?:е(?:ян(?:ия(?:[\\s\\xa0]*на[\\s\\xa0]*(?:светите[\\s\\xa0]*Апостоли|апостолите)|та[\\s\\xa0]*на[\\s\\xa0]*апостолите)?)?|ла)|\\.?[\\s\\xa0]*А)|Апостол|Acts))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Rom"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Послание[\\s\\xa0]*(?:на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Павла[\\s\\xa0]*до[\\s\\xa0]*Римляни|към[\\s\\xa0]*римляните)|римляните|Римляни|Римл?|Rom))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Cor"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Втор(?:о[\\s\\xa0]*(?:послание[\\s\\xa0]*(?:на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Павла[\\s\\xa0]*до[\\s\\xa0]*Коринтяни|към[\\s\\xa0]*коринтяните)|Кор(?:интяните|интяни)?)|а[\\s\\xa0]*Кор(?:интяните|интяни)?)|(?:(?:II|2)\\.|II|2)[\\s\\xa0]*Коринтяните|(?:(?:II|2)\\.|II|2)[\\s\\xa0]*Кор(?:интяни)?|2Cor))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Cor"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Първ(?:о[\\s\\xa0]*(?:послание[\\s\\xa0]*(?:на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Павла[\\s\\xa0]*до[\\s\\xa0]*Коринтяни|към[\\s\\xa0]*коринтяните)|Кор(?:интяните|интяни)?)|а[\\s\\xa0]*Кор(?:интяните|интяни)?)|(?:[1I]\\.|[1I])[\\s\\xa0]*Коринтяните|(?:[1I]\\.|[1I])[\\s\\xa0]*Кор(?:интяни)?|1Cor))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Gal"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Послание[\\s\\xa0]*(?:на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Павла[\\s\\xa0]*до[\\s\\xa0]*Галатяни|към[\\s\\xa0]*галатяните)|Галатяните|Гал(?:атяни)?|Gal))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Eph"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Послание[\\s\\xa0]*(?:на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Павла[\\s\\xa0]*до[\\s\\xa0]*Ефесяни|към[\\s\\xa0]*ефесяните)|Ефесяните|Еф(?:есяни)?|Eph))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Phil"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Послание[\\s\\xa0]*(?:на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Павла[\\s\\xa0]*до[\\s\\xa0]*Филипяни|към[\\s\\xa0]*филипяните)|Филипяните|Фил(?:ипяни)?|Phil))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Col"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Послание[\\s\\xa0]*(?:на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Павла[\\s\\xa0]*до[\\s\\xa0]*Колосяни|към[\\s\\xa0]*колосяните)|Колосяните|Кол(?:осяни)?|Col))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Thess"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Втор(?:о[\\s\\xa0]*(?:послание[\\s\\xa0]*(?:на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Павла[\\s\\xa0]*до[\\s\\xa0]*Солуняни|към[\\s\\xa0]*солунците)|Сол(?:унците|уняни|унци)?)|а[\\s\\xa0]*Сол(?:унците|уняни|унци)?)|(?:(?:II|2)\\.|II|2)[\\s\\xa0]*Солунците|(?:(?:II|2)\\.|II|2)[\\s\\xa0]*Солуняни|(?:(?:II|2)\\.|II|2)[\\s\\xa0]*Сол(?:унци)?|2Thess))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Thess"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Първ(?:о[\\s\\xa0]*(?:послание[\\s\\xa0]*(?:на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Павла[\\s\\xa0]*до[\\s\\xa0]*Солуняни|към[\\s\\xa0]*солунците)|Сол(?:унците|уняни|унци)?)|а[\\s\\xa0]*Сол(?:унците|уняни|унци)?)|(?:[1I]\\.|[1I])[\\s\\xa0]*Солунците|(?:[1I]\\.|[1I])[\\s\\xa0]*Солуняни|(?:[1I]\\.|[1I])[\\s\\xa0]*Сол(?:унци)?|1Thess))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Tim"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Втор(?:о[\\s\\xa0]*(?:послание[\\s\\xa0]*(?:на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Павла[\\s\\xa0]*до[\\s\\xa0]*Тимотея|към[\\s\\xa0]*Тимоте[ий])|Тим(?:оте[ий])?)|а[\\s\\xa0]*Тим(?:оте[ий])?)|(?:(?:II|2)\\.|II|2)[\\s\\xa0]*Тимоте[ий]|(?:(?:II|2)\\.|II|2)[\\s\\xa0]*Тим|2Tim))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Tim"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Първ(?:о[\\s\\xa0]*(?:послание[\\s\\xa0]*(?:на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Павла[\\s\\xa0]*до[\\s\\xa0]*Тимотея|към[\\s\\xa0]*Тимоте[ий])|Тим(?:оте[ий])?)|а[\\s\\xa0]*Тим(?:оте[ий])?)|(?:[1I]\\.|[1I])[\\s\\xa0]*Тимоте[ий]|(?:[1I]\\.|[1I])[\\s\\xa0]*Тим|1Tim))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Titus"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Послание[\\s\\xa0]*(?:на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Павла[\\s\\xa0]*до[\\s\\xa0]*Тита|към[\\s\\xa0]*Тит)|Titus|Тит))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Phlm"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Послание[\\s\\xa0]*(?:на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Павла[\\s\\xa0]*до[\\s\\xa0]*Филимона|към[\\s\\xa0]*Филимон)|Филимон|Филим|Phlm|Флм))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Heb"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Послание[\\s\\xa0]*(?:на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Павла[\\s\\xa0]*до[\\s\\xa0]*Е|към[\\s\\xa0]*е)вреите|Евреите|Евр(?:еи)?|Heb))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Jas"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Съборно[\\s\\xa0]*послание[\\s\\xa0]*на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Иакова|Послание[\\s\\xa0]*на[\\s\\xa0]*Яков|Яков|Иак|Jas|Як))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Pet"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Втор(?:о[\\s\\xa0]*(?:съборно[\\s\\xa0]*послание[\\s\\xa0]*на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Петра|послание[\\s\\xa0]*на[\\s\\xa0]*Петър|Пет(?:рово|ър)|Петр?)|а[\\s\\xa0]*Пет(?:рово|ър|р)?)|(?:(?:II|2)\\.|II|2)[\\s\\xa0]*Петрово|(?:(?:II|2)\\.|II|2)[\\s\\xa0]*Петър|(?:(?:II|2)\\.|II|2)[\\s\\xa0]*Петр?|2Pet))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Pet"],
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Първ(?:о[\\s\\xa0]*(?:съборно[\\s\\xa0]*послание[\\s\\xa0]*на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Петра|послание[\\s\\xa0]*на[\\s\\xa0]*Петър|Пет(?:рово|ър)|Петр?)|а[\\s\\xa0]*Пет(?:рово|ър|р)?)|(?:[1I]\\.|[1I])[\\s\\xa0]*Петрово|(?:[1I]\\.|[1I])[\\s\\xa0]*Петър|(?:[1I]\\.|[1I])[\\s\\xa0]*Петр?|1Pet))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Jude"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Съборно[\\s\\xa0]*послание[\\s\\xa0]*на[\\s\\xa0]*св(?:\\.[\\s\\xa0]*ап\\.?|[\\s\\xa0]*ап\\.?)[\\s\\xa0]*Иуда|(?:Послание[\\s\\xa0]*на[\\s\\xa0]*)?Юда|Jude|Иуд))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Tob"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*(?:на[\\s\\xa0]*Товита?|за[\\s\\xa0]*Тобия)|Товита?|Тобия|Тов|Tob))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Jdt"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*(?:за[\\s\\xa0]*Юдита|Иудит)|Иудит|Юдит|Jdt|Юд))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Bar"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Книга[\\s\\xa0]*на[\\s\\xa0]*(?:пророк[\\s\\xa0]*Варуха|Барух)|Варуха|Вар(?:ух)?|Bar))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Sus"],
			apocrypha: true,
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Сус(?:ана)?|Sus))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["2Macc"],
			apocrypha: true,
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Втор(?:а[\\s\\xa0]*(?:книга[\\s\\xa0]*(?:на[\\s\\xa0]*Макавеите|Макаве[ий]ска)|Макавеи)|о[\\s\\xa0]*Макавеи)|(?:(?:II|2)\\.|II)[\\s\\xa0]*Макавеи|2(?:[\\s\\xa0]*Макавеи|Macc)|2[\\s\\xa0]*Мак))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["3Macc"],
			apocrypha: true,
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Трет(?:о[\\s\\xa0]*(?:книга[\\s\\xa0]*на[\\s\\xa0]*Макавеите|Макавеи)|а[\\s\\xa0]*(?:книга[\\s\\xa0]*Макаве[ий]ска|Макавеи))|(?:III\\.?|3\\.)[\\s\\xa0]*Макавеи|3(?:[\\s\\xa0]*Макавеи|Macc)|3[\\s\\xa0]*Мак))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["4Macc"],
			apocrypha: true,
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Четвърт(?:а[\\s\\xa0]*(?:книга[\\s\\xa0]*на[\\s\\xa0]*Макавеите|Макавеи)|о[\\s\\xa0]*Макавеи)|(?:(?:IV|4)\\.|IV)[\\s\\xa0]*Макавеи|4(?:[\\s\\xa0]*Макавеи|Macc)|4[\\s\\xa0]*Мак))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["1Macc"],
			apocrypha: true,
			regexp: new RegExp(`(^|[^0-9A-Za-zªµºÀ-ÖØ-öø-ɏЀ-ҁ҃-҇Ҋ-ԧḀ-ỿⱠ-Ɀⷠ-ⷿꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꟿ])((?:Първ(?:а[\\s\\xa0]*(?:книга[\\s\\xa0]*(?:на[\\s\\xa0]*Макавеите|Макаве[ий]ска)|Макавеи)|о[\\s\\xa0]*Макавеи)|(?:[1I]\\.|I)[\\s\\xa0]*Макавеи|1(?:[\\s\\xa0]*Макавеи|Macc)|1[\\s\\xa0]*Мак))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Ezek", "Ezra"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Ез))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
		{
			osis: ["Hab", "Obad"],
			regexp: new RegExp(`(^|${bcv_parser.prototype.regexps.pre_book})((?:Ав))(?:(?=[\\d\\s\\xa0.:,;\\x1e\\x1f&\\(\\)\\uff08\\uff09\\[\\]/"'\\*=~\\-\\u2013\\u2014])|$)`, "gi")
		},
	];
	// Short-circuit the look if we know we want all the books.
	if ((include_apocrypha) && (case_sensitive === "none")) { return books; }
	// Filter out books in the Apocrypha if we don't want them. `Array.map` isn't supported below IE9.
	const out = [];
	for (const book of books) {
		if ((!include_apocrypha) && (book.apocrypha != null) && (book.apocrypha)) { continue; }
		if (case_sensitive === "books") {
			book.regexp = new RegExp(book.regexp.source, "g");
		}
		out.push(book);
	}
	return out;
};

// Default to not using the Apocrypha
bcv_parser.prototype.regexps.books = bcv_parser.prototype.regexps.get_books(false, "none");
