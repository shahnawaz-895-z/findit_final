import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  TextInput
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

const HelpScreen = ({ navigation }) => {
  const [activeSection, setActiveSection] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const faqData = [
    {
      id: '1',
      question: 'How do I report a lost item?',
      answer: 'To report a lost item, go to the home screen and tap on "Report Lost" in the Quick Actions section. Fill in the details about your lost item including description, location where it was lost, date and time, and any photos if available. The more details you provide, the better chance you have of finding your item.'
    },
    {
      id: '2',
      question: 'How do I report a found item?',
      answer: 'To report a found item, go to the home screen and tap on "Report Found" in the Quick Actions section. Provide details about the item you found including description, location where you found it, date and time, and photos if possible. Be careful not to share identifying information that only the owner would know.'
    },
    {
      id: '3',
      question: 'How does the matching system work?',
      answer: 'Our system uses advanced algorithms to match lost items with found items based on descriptions, locations, dates, and other details. When a potential match is found, both parties will receive a notification. You can view all your matches in the "Matches" section.'
    },
    {
      id: '4',
      question: 'How do I contact someone who found my item?',
      answer: 'When a match is made, you can communicate with the finder through our in-app messaging system. This protects your privacy while allowing you to arrange for the return of your item. Simply go to the match details and tap on "Message" to start a conversation.'
    },
    {
      id: '5',
      question: 'Is my personal information safe?',
      answer: 'Yes, we take privacy very seriously. Your personal information is encrypted and never shared with other users without your permission. When a match is made, only the information necessary for returning the item is shared, and you can communicate through our secure messaging system.'
    },
    {
      id: '6',
      question: 'What should I do if I can\'t find my item in the app?',
      answer: 'If you can\'t find your item, make sure to check back regularly as new found items are added daily. You can also try broadening your search criteria or updating your lost item report with additional details that might help with matching.'
    },
  ];

  const filteredFAQs = searchQuery 
    ? faqData.filter(faq => 
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : faqData;

  const toggleSection = (id) => {
    if (activeSection === id) {
      setActiveSection(null);
    } else {
      setActiveSection(id);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Icon name="search-outline" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for help..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Icon name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.helpSection}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          {filteredFAQs.length > 0 ? (
            filteredFAQs.map(faq => (
              <View key={faq.id} style={styles.faqItem}>
                <TouchableOpacity 
                  style={styles.faqQuestion}
                  onPress={() => toggleSection(faq.id)}
                >
                  <Text style={styles.questionText}>{faq.question}</Text>
                  <Icon 
                    name={activeSection === faq.id ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#3d0c45" 
                  />
                </TouchableOpacity>
                {activeSection === faq.id && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.answerText}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <View style={styles.noResults}>
              <Icon name="search-outline" size={48} color="#ccc" />
              <Text style={styles.noResultsText}>No results found</Text>
              <Text style={styles.noResultsSubtext}>Try different keywords or browse the FAQs below</Text>
            </View>
          )}
        </View>

        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>Contact Support</Text>
          <Text style={styles.contactText}>
            Can't find what you're looking for? Our support team is here to help.
          </Text>
          <TouchableOpacity style={styles.contactButton}>
            <Icon name="mail-outline" size={20} color="#fff" style={styles.contactButtonIcon} />
            <Text style={styles.contactButtonText}>Email Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: STATUSBAR_HEIGHT,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3d0c45',
    paddingVertical: 16,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  helpSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  faqItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    paddingRight: 8,
  },
  faqAnswer: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  answerText: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  noResults: {
    alignItems: 'center',
    padding: 24,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  noResultsSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  contactSection: {
    padding: 24,
    backgroundColor: '#f0e6f2',
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  contactText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3d0c45',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  contactButtonIcon: {
    marginRight: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HelpScreen; 