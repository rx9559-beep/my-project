document.addEventListener('DOMContentLoaded', function() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
      question.addEventListener('click', function() {
        const answer = this.nextElementSibling;
        const indicator = this.querySelector('.faq-indicator');
        
        answer.classList.toggle('active');
        
        if (answer.classList.contains('active')) {
          indicator.textContent = '-';
        } else {
          indicator.textContent = '+';
        }
        
        document.querySelectorAll('.faq-answer').forEach(item => {
          if (item !== answer && item.classList.contains('active')) {
            item.classList.remove('active');
            item.previousElementSibling.querySelector('.faq-indicator').textContent = '+';
          }
        });
      });
    });
    
    const searchInput = document.getElementById('faqSearch');
    const faqItems = document.querySelectorAll('.faq-item');
    
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      
      faqItems.forEach(item => {
        const question = item.querySelector('.faq-question h4').textContent.toLowerCase();
        const answer = item.querySelector('.faq-answer').textContent.toLowerCase();
        
        if (question.includes(searchTerm) || answer.includes(searchTerm)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });