import * as R4 from './R4';

describe('R4', () => {
  describe('stripHtmlTags', () => {
    describe('basic HTML tag removal', () => {
      it('should remove simple paragraph tags', () => {
        expect(R4.stripHtmlTags('<p>Hello World</p>')).toBe('Hello World');
      });

      it('should remove nested HTML tags', () => {
        expect(R4.stripHtmlTags('<div><span>Nested</span> content</div>')).toBe(
          'Nested content',
        );
      });

      it('should remove self-closing tags', () => {
        expect(R4.stripHtmlTags('Line one<br/>Line two')).toBe('Line one Line two');
      });

      it('should remove multiple different tags', () => {
        expect(
          R4.stripHtmlTags(
            '<h1>Title</h1><p>Paragraph</p><span>Span</span>',
          ),
        ).toBe('Title Paragraph Span');
      });

      it('should remove tags with attributes', () => {
        expect(
          R4.stripHtmlTags('<div class="test" id="main">Content</div>'),
        ).toBe('Content');
      });
    });

    describe('HTML entity decoding', () => {
      it('should decode &nbsp; to space', () => {
        expect(R4.stripHtmlTags('Hello&nbsp;World')).toBe('Hello World');
        expect(R4.stripHtmlTags('Hello&NBSP;World')).toBe('Hello World');
      });

      it('should decode &amp; to ampersand', () => {
        expect(R4.stripHtmlTags('Tom &amp; Jerry')).toBe('Tom & Jerry');
        expect(R4.stripHtmlTags('Tom &AMP; Jerry')).toBe('Tom & Jerry');
      });

      it('should decode &lt; to less than', () => {
        expect(R4.stripHtmlTags('5 &lt; 10')).toBe('5 < 10');
        expect(R4.stripHtmlTags('5 &LT; 10')).toBe('5 < 10');
      });

      it('should decode &gt; to greater than', () => {
        expect(R4.stripHtmlTags('10 &gt; 5')).toBe('10 > 5');
        expect(R4.stripHtmlTags('10 &GT; 5')).toBe('10 > 5');
      });

      it('should decode &quot; to double quote', () => {
        expect(R4.stripHtmlTags('Say &quot;Hello&quot;')).toBe('Say "Hello"');
        expect(R4.stripHtmlTags('Say &QUOT;Hello&QUOT;')).toBe('Say "Hello"');
      });

      it('should decode &#39; to apostrophe', () => {
        expect(R4.stripHtmlTags("It&#39;s working")).toBe("It's working");
        expect(R4.stripHtmlTags("It&#39;s working")).toBe("It's working");
      });

      it('should decode multiple entities in one string', () => {
        expect(
          R4.stripHtmlTags(
            'Tom&nbsp;&amp;&nbsp;Jerry: &lt;friends&gt; &quot;forever&quot;',
          ),
        ).toBe('Tom & Jerry: <friends> "forever"');
      });
    });

    describe('whitespace normalization', () => {
      it('should normalize multiple spaces to single space', () => {
        expect(R4.stripHtmlTags('Hello    World')).toBe('Hello World');
        expect(R4.stripHtmlTags('Multiple   spaces   here')).toBe(
          'Multiple spaces here',
        );
      });

      it('should normalize tabs and newlines to single space', () => {
        expect(R4.stripHtmlTags('Hello\t\tWorld')).toBe('Hello World');
        expect(R4.stripHtmlTags('Line1\n\nLine2')).toBe('Line1 Line2');
        expect(R4.stripHtmlTags('Mixed\t\n\r  whitespace')).toBe(
          'Mixed whitespace',
        );
      });

      it('should trim leading and trailing whitespace', () => {
        expect(R4.stripHtmlTags('  Hello World  ')).toBe('Hello World');
        expect(R4.stripHtmlTags('\n\tHello\t\n')).toBe('Hello');
      });

      it('should handle whitespace from removed tags', () => {
        expect(R4.stripHtmlTags('<p>Para 1</p>  <p>Para 2</p>')).toBe(
          'Para 1 Para 2',
        );
      });
    });

    describe('edge cases', () => {
      it('should return undefined for undefined input', () => {
        expect(R4.stripHtmlTags(undefined)).toBeUndefined();
      });

      it('should return undefined for empty string', () => {
        expect(R4.stripHtmlTags('')).toBeUndefined();
      });

      it('should return empty string for whitespace-only string after processing', () => {
        expect(R4.stripHtmlTags('   ')).toBe('');
        expect(R4.stripHtmlTags('\n\t\r')).toBe('');
      });

      it('should handle malformed HTML tags', () => {
        expect(R4.stripHtmlTags('Text with < incomplete tag')).toBe(
          'Text with < incomplete tag',
        );
        expect(R4.stripHtmlTags('Text with > orphan bracket')).toBe(
          'Text with > orphan bracket',
        );
      });

      it('should handle strings with only HTML tags', () => {
        expect(R4.stripHtmlTags('<div></div>')).toBe('');
        expect(R4.stripHtmlTags('<br/><hr/>')).toBe('');
      });

      it('should handle mixed tags, entities, and whitespace', () => {
        expect(
          R4.stripHtmlTags(
            '<p>  Hello&nbsp;&nbsp;World  </p>\n<span>Test</span>',
          ),
        ).toBe('Hello World Test');
      });
    });

    describe('real-world FHIR examples', () => {
      it('should handle XHTML div content from Encounter', () => {
        const xhtml =
          '<div xmlns="http://www.w3.org/1999/xhtml">Office&nbsp;Visit&nbsp;-&nbsp;Established&nbsp;Patient</div>';
        expect(R4.stripHtmlTags(xhtml)).toBe(
          'Office Visit - Established Patient',
        );
      });

      it('should handle XHTML div content from AllergyIntolerance', () => {
        const xhtml =
          '<div xmlns="http://www.w3.org/1999/xhtml"><p>Allergy to penicillin</p><p>Reaction: Hives &amp; Itching</p></div>';
        expect(R4.stripHtmlTags(xhtml)).toBe(
          'Allergy to penicillin Reaction: Hives & Itching',
        );
      });

      it('should handle XHTML div content from Practitioner', () => {
        const xhtml =
          '<div xmlns="http://www.w3.org/1999/xhtml">Dr.&nbsp;John&nbsp;Smith,&nbsp;MD</div>';
        expect(R4.stripHtmlTags(xhtml)).toBe('Dr. John Smith, MD');
      });

      it('should handle complex XHTML with multiple elements', () => {
        const xhtml =
          '<div xmlns="http://www.w3.org/1999/xhtml">\n  <h1>Patient Summary</h1>\n  <p>Name: John &quot;Johnny&quot; Doe</p>\n  <p>Age: 5 &lt; age &lt; 10</p>\n  <br/>\n  <p>Status: Active &amp; Enrolled</p>\n</div>';
        expect(R4.stripHtmlTags(xhtml)).toBe(
          'Patient Summary Name: John "Johnny" Doe Age: 5 < age < 10 Status: Active & Enrolled',
        );
      });
    });

    describe('XSS prevention verification', () => {
      it('should strip script tags and content', () => {
        const malicious = '<script>alert("XSS")</script>Safe text';
        expect(R4.stripHtmlTags(malicious)).toBe('alert("XSS") Safe text');
      });

      it('should strip event handlers from tags', () => {
        const malicious = '<div onclick="alert(\'XSS\')">Click me</div>';
        expect(R4.stripHtmlTags(malicious)).toBe('Click me');
      });

      it('should not execute any code from input', () => {
        const malicious = '<img src=x onerror="alert(\'XSS\')">';
        expect(R4.stripHtmlTags(malicious)).toBe('');
      });
    });
  });
});
